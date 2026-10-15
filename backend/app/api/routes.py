import asyncio
import math
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.integrations.open_meteo import SOURCE, SOURCE_TYPE, SourceUnavailable, search_cities, source_status
from app.models import AirQualityObservation, City, ForecastRun, ForecastValue, IngestionJob, ModelRegistry, WeatherObservation
from app.services.ingestion import ingest_city

router = APIRouter()
UNITS = "µg/m³"
_refresh_locks = [asyncio.Lock() for _ in range(64)]


def aware(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def city_dict(city):
    return {key: getattr(city, key) for key in ("id", "name", "country", "administrative_region", "latitude", "longitude", "timezone")}


def city_or_404(db, city_id):
    city = db.get(City, city_id)
    if city is None:
        raise HTTPException(404, "Unknown city. Search for a city first.")
    return city


def observation_dict(row):
    return {"timestamp": aware(row.timestamp), **{key: getattr(row, key) for key in ("pm25", "pm10", "no2", "o3", "so2", "co")}, "retrieved_at": aware(row.retrieved_at)}


async def refresh(db, city, days=7):
    async with _refresh_locks[hash(city.id) % len(_refresh_locks)]:
        latest = db.scalar(select(AirQualityObservation).where(AirQualityObservation.city_id == city.id).order_by(AirQualityObservation.timestamp.desc()).limit(1))
        count = db.scalar(select(func.count()).select_from(AirQualityObservation).where(AirQualityObservation.city_id == city.id, AirQualityObservation.timestamp >= datetime.now(UTC) - timedelta(days=days)))
        now = datetime.now(UTC)
        if latest and aware(latest.timestamp) == now.replace(minute=0, second=0, microsecond=0) and now - aware(latest.retrieved_at) < timedelta(minutes=30) and count >= days * 23:
            return []
        try:
            start = (datetime.now(UTC) - timedelta(days=days)).date() if days > 92 else None
            result = await ingest_city(db, city, days=days, start_date=start, end_date=datetime.now(UTC).date() if start else None)
            return [result["warning"]] if result.get("warning") else []
        except SourceUnavailable as exc:
            if latest:
                return [f"Source unavailable; displaying stored data. {exc}"]
            raise HTTPException(503, str(exc)) from exc


@router.get("/cities")
def cities(db: Session = Depends(get_db)):
    return {"cities": [city_dict(city) for city in db.scalars(select(City).order_by(City.name))]}


@router.get("/cities/search")
async def cities_search(q: str = Query(min_length=2, max_length=100), db: Session = Depends(get_db)):
    try:
        found = await search_cities(q.strip())
    except SourceUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    # Reuse known coordinates to retain model coverage when a seeded city is searched.
    existing = list(db.scalars(select(City)))
    result = []
    for item in found:
        match = next((city for city in existing if abs(city.latitude - item["latitude"]) < .08 and abs(city.longitude - item["longitude"]) < .08), None)
        if match:
            result.append(city_dict(match))
        else:
            db.merge(City(**item))
            result.append(item)
    db.commit()
    return {"cities": result}


@router.get("/air-quality/current")
async def current(city_id: str = "cairo", db: Session = Depends(get_db)):
    city = city_or_404(db, city_id)
    warnings = await refresh(db, city, 7)
    row = db.scalar(select(AirQualityObservation).where(AirQualityObservation.city_id == city.id, AirQualityObservation.timestamp <= datetime.now(UTC)).order_by(AirQualityObservation.timestamp.desc()).limit(1))
    if row is None:
        raise HTTPException(404, "No current observations are available")
    weather = db.scalar(select(WeatherObservation).where(WeatherObservation.city_id == city.id, WeatherObservation.timestamp <= row.timestamp).order_by(WeatherObservation.timestamp.desc()).limit(1))
    age = (datetime.now(UTC) - aware(row.timestamp)).total_seconds() / 3600
    if age > 6:
        warnings.append("Latest stored air quality is more than six hours old")
    return {"city": city_dict(city), "observation": observation_dict(row), "weather": {"timestamp": aware(weather.timestamp), "source": weather.source, "units": {"temperature": "°C", "humidity": "%", "wind_speed": "m/s", "wind_direction": "°", "precipitation": "mm", "pressure": "hPa"}, **{key: getattr(weather, key) for key in ("temperature", "humidity", "wind_speed", "wind_direction", "precipitation", "pressure")}} if weather else None, "source": row.source, "source_type": row.source_type, "retrieved_at": aware(row.retrieved_at), "age_hours": round(age, 2), "units": UNITS, "warnings": warnings}


@router.get("/air-quality/history")
async def history(city_id: str = "cairo", days: int = Query(7, ge=1, le=365), db: Session = Depends(get_db)):
    city = city_or_404(db, city_id)
    warnings = await refresh(db, city, days)
    records = db.scalars(select(AirQualityObservation).where(AirQualityObservation.city_id == city.id, AirQualityObservation.timestamp >= datetime.now(UTC) - timedelta(days=days), AirQualityObservation.timestamp <= datetime.now(UTC)).order_by(AirQualityObservation.timestamp))
    return {"city": city_dict(city), "records": [observation_dict(row) for row in records], "source": SOURCE, "source_type": SOURCE_TYPE, "units": UNITS, "warnings": warnings}


class ForecastRequest(BaseModel):
    city_id: str = Field(default="cairo", min_length=1, max_length=100)


async def make_forecast(city_id, db, force=False):
    city = city_or_404(db, city_id)
    warnings = await refresh(db, city, 7)
    active = db.scalar(select(ModelRegistry).where(ModelRegistry.active.is_(True)).order_by(ModelRegistry.training_date.desc()).limit(1))
    cached = db.scalar(select(ForecastRun).where(ForecastRun.city_id == city.id, ForecastRun.status == "completed").order_by(ForecastRun.issued_at.desc()).limit(1))
    now = datetime.now(UTC)
    if not force and cached and active and cached.model_version == active.version and aware(cached.source_data_timestamp) == now.replace(minute=0, second=0, microsecond=0) and now - aware(cached.issued_at) < timedelta(hours=1):
        response = dict(cached.response_json)
        response["warnings"] = list(response.get("warnings", [])) + warnings
        return response
    try:
        from app.ml.inference import generate_forecast
        response = await asyncio.to_thread(generate_forecast, db, city)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(409, str(exc)) from exc
    response = jsonable_encoder(response)
    response.setdefault("warnings", []).extend(warnings)
    response.setdefault("city", city_dict(city))
    response.setdefault("source", SOURCE)
    response.setdefault("units", UNITS)
    run = ForecastRun(city_id=city.id, model_version=response["model_version"], issued_at=datetime.fromisoformat(response["issued_at"]), source_data_timestamp=datetime.fromisoformat(response["observation_timestamp"]), response_json=response)
    db.add(run)
    db.flush()
    for value in response["values"]:
        db.add(ForecastValue(forecast_run_id=run.id, target_timestamp=datetime.fromisoformat(value["timestamp"]), horizon_hours=value["horizon_hours"], predicted_pm25=value["predicted_pm25"], lower_bound=value.get("lower_bound"), upper_bound=value.get("upper_bound")))
    db.commit()
    return response


@router.get("/forecast/72h")
async def forecast(city_id: str = "cairo", db: Session = Depends(get_db)):
    return await make_forecast(city_id, db)


@router.post("/forecast/generate")
async def forecast_generate(body: ForecastRequest, db: Session = Depends(get_db)):
    return await make_forecast(body.city_id, db, force=True)


@router.get("/models")
@router.get("/models/metrics")
def models(db: Session = Depends(get_db)):
    return {"models": [{"version": row.version, "model_name": row.model_name, "training_date": aware(row.training_date), "metrics": row.evaluation_metrics, "metadata": row.metadata_json, "active": row.active} for row in db.scalars(select(ModelRegistry).order_by(ModelRegistry.training_date.desc()))]}


@router.get("/models/feature-importance")
def feature_importance(db: Session = Depends(get_db)):
    row = db.scalar(select(ModelRegistry).where(ModelRegistry.active.is_(True)).order_by(ModelRegistry.training_date.desc()).limit(1))
    metadata = row.metadata_json if row else {}
    if isinstance(metadata.get("feature_importance"), dict):
        return metadata["feature_importance"]
    return {"features": metadata.get("feature_importance", []), "method": metadata.get("importance_method", "unavailable"), "description": "Global model importance measures predictive association, not causal effects."}


@router.get("/data/coverage")
def coverage(db: Session = Depends(get_db)):
    rows = db.execute(select(City, func.count(AirQualityObservation.id), func.min(AirQualityObservation.timestamp), func.max(AirQualityObservation.timestamp), func.count(AirQualityObservation.id) - func.count(AirQualityObservation.pm25), func.max(AirQualityObservation.retrieved_at)).outerjoin(AirQualityObservation, City.id == AirQualityObservation.city_id).group_by(City.id).order_by(City.name)).all()
    return {"cities": [{"city": city_dict(city), "records": count, "start": aware(start) if start else None, "end": aware(end) if end else None, "missing_pm25": missing, "latest_ingestion": aware(latest) if latest else None, "expected_hours": int((aware(end) - aware(start)).total_seconds() / 3600) + 1 if start and end else 0, "gap_hours": max(0, int((aware(end) - aware(start)).total_seconds() / 3600) + 1 - count) if start and end else 0} for city, count, start, end, missing, latest in rows], "source": SOURCE, "source_type": SOURCE_TYPE, "units": UNITS}


@router.get("/analytics/city-comparison")
async def comparison(city_ids: str = "cairo,london", db: Session = Depends(get_db)):
    ids = list(dict.fromkeys(city_ids.split(",")))
    if not 2 <= len(ids) <= 5:
        raise HTTPException(422, "Select between two and five distinct cities")
    result = []
    for city_id in ids:
        try:
            result.append(await current(city_id.strip(), db))
        except HTTPException as exc:
            result.append({"city": city_dict(city_or_404(db, city_id.strip())), "error": exc.detail})
    return {"cities": result}


@router.get("/analytics/map-snapshot")
async def map_snapshot(city_ids: str = Query("cairo,london", min_length=1, max_length=600), hours_ago: int = Query(0, ge=0, le=2160), db: Session = Depends(get_db)):
    ids = [value.strip() for value in city_ids.split(",")]
    if not 1 <= len(ids) <= 5 or any(not value for value in ids) or len(set(ids)) != len(ids):
        raise HTTPException(422, "Select between one and five unique city IDs")
    selected = [city_or_404(db, city_id) for city_id in ids]
    requested_at = datetime.now(UTC)
    target_timestamp = requested_at - timedelta(hours=hours_ago)
    days = min(92, max(7, math.ceil(hours_ago / 24) + 2))
    result = []
    for city in selected:
        warnings = ["Retrospective model-derived archive values; historical as-issued availability and revisions are not established."]
        try:
            warnings.extend(await refresh(db, city, days))
        except HTTPException as exc:
            # Existing history may still cover this cutoff despite a current refresh failure.
            warnings.append(str(exc.detail))
        row = db.scalar(select(AirQualityObservation).where(AirQualityObservation.city_id == city.id, AirQualityObservation.timestamp <= target_timestamp).order_by(AirQualityObservation.timestamp.desc()).limit(1))
        if row is None:
            result.append({"city": city_dict(city), "error": "No stored air-quality estimate is available at or before the requested time.", "warnings": warnings})
            continue
        gap_hours = (target_timestamp - aware(row.timestamp)).total_seconds() / 3600
        if gap_hours > 1:
            warnings.append(f"The latest available estimate precedes the selected time by {gap_hours:.1f} hours; no interpolation was applied.")
        result.append({"city": city_dict(city), "observation": observation_dict(row), "source": row.source, "source_type": row.source_type, "retrieved_at": aware(row.retrieved_at), "age_hours": round((requested_at - aware(row.timestamp)).total_seconds() / 3600, 2), "warnings": warnings})
    return {"cities": result, "requested_at": requested_at, "target_timestamp": target_timestamp, "units": UNITS}


@router.get("/analytics/patterns")
async def patterns(city_id: str = "cairo", days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    data = await history(city_id, days, db)
    groups = {}
    values = [row["pm25"] for row in data["records"] if row["pm25"] is not None]
    for row in data["records"]:
        if row["pm25"] is not None:
            groups.setdefault(row["timestamp"].hour, []).append(row["pm25"])
    mean = sum(values) / len(values) if values else None
    std = (sum((value - mean) ** 2 for value in values) / len(values)) ** .5 if values else None
    anomalies = [row for row in data["records"] if row["pm25"] is not None and std and row["pm25"] > mean + 3 * std]
    return {"city": data["city"], "hourly_pattern": [{"hour": hour, "mean_pm25": sum(group) / len(group), "samples": len(group)} for hour, group in sorted(groups.items())], "anomalies": anomalies, "anomaly_method": "PM2.5 above window mean plus three population standard deviations", "timezone": "UTC", "units": UNITS}


@router.get("/system/status")
def status(db: Session = Depends(get_db)):
    from app.services.scheduler import scheduler
    db.execute(text("SELECT 1"))
    job = db.scalar(select(IngestionJob).where(IngestionJob.status.in_(["completed", "completed_with_warnings"])).order_by(IngestionJob.completed_at.desc()).limit(1))
    run = db.scalar(select(ForecastRun).order_by(ForecastRun.issued_at.desc()).limit(1))
    model = db.scalar(select(ModelRegistry).where(ModelRegistry.active.is_(True)).limit(1))
    return {"backend": "operational", "database": "connected", "checked_at": datetime.now(UTC), "data_sources": source_status or {"status": "not checked this process"}, "last_successful_ingestion": aware(job.completed_at) if job else None, "last_forecast_generation": aware(run.issued_at) if run else None, "active_model_version": model.version if model else None, "scheduler": {"running": scheduler.running, "jobs": [{"id": item.id, "next_run": item.next_run_time} for item in scheduler.get_jobs()]}}


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
