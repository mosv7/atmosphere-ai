import asyncio
from datetime import UTC, datetime, timedelta
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from app.models import AirQualityObservation, City, IngestionJob, WeatherObservation
from app.integrations.open_meteo import SOURCE, SOURCE_TYPE, fetch_air_quality, fetch_weather

SEED_CITIES = [
    ("cairo", "Cairo", "Egypt", "Cairo", 30.0444, 31.2357, "Africa/Cairo"),
    ("london", "London", "United Kingdom", "England", 51.5085, -0.1257, "Europe/London"),
    ("delhi", "Delhi", "India", "Delhi", 28.6519, 77.2315, "Asia/Kolkata"),
    ("new-york", "New York", "United States", "New York", 40.7143, -74.006, "America/New_York"),
    ("tokyo", "Tokyo", "Japan", "Tokyo", 35.6895, 139.6917, "Asia/Tokyo"),
    ("sao-paulo", "São Paulo", "Brazil", "São Paulo", -23.5475, -46.6361, "America/Sao_Paulo"),
    ("sydney", "Sydney", "Australia", "New South Wales", -33.8679, 151.2073, "Australia/Sydney"),
    ("nairobi", "Nairobi", "Kenya", "Nairobi", -1.2833, 36.8167, "Africa/Nairobi"),
]


def seed_cities(db):
    keys = ("id", "name", "country", "administrative_region", "latitude", "longitude", "timezone")
    for values in SEED_CITIES:
        if db.get(City, values[0]) is None:
            db.add(City(**dict(zip(keys, values))))
    db.commit()


def store_records(db, model, city_id, rows, source):
    """Conflict updates preserve corrected source values and keep ingestion idempotent."""
    now = datetime.now(UTC)
    records = [{**row, "city_id": city_id, "source": row.get("source", source), "retrieved_at": now, **({"source_type": SOURCE_TYPE} if model is AirQualityObservation else {})} for row in rows]
    records = list({(row["timestamp"], row["source"]): row for row in records}.values())
    if not records:
        return 0
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    for offset in range(0, len(records), 500):
        stmt = insert(model).values(records[offset:offset + 500])
        stmt = stmt.on_conflict_do_update(index_elements=["city_id", "timestamp", "source"], set_={key: getattr(stmt.excluded, key) for key in records[0] if key not in ("city_id", "timestamp", "source")})
        db.execute(stmt)
    db.flush()
    return len(records)


async def ingest_city(db, city, days=7, start_date=None, end_date=None, include_weather=True):
    if not 1 <= days <= 3650:
        raise ValueError("days must be between 1 and 3650")
    if start_date is not None and end_date is not None and str(start_date) > str(end_date):
        raise ValueError("start_date must precede end_date")
    job = IngestionJob(city_id=city.id)
    db.add(job)
    db.commit()
    try:
        aq_rows = await fetch_air_quality(city, start_date=start_date, end_date=end_date, days=days)
        now = datetime.now(UTC)
        # The endpoint also emits future CAMS forecasts. These never enter observation storage.
        aq_rows = [row for row in aq_rows if row["timestamp"] <= now]
        count = store_records(db, AirQualityObservation, city.id, aq_rows, SOURCE)
        warning = None
        if include_weather:
            try:
                weather_rows = await fetch_weather(city, start_date=start_date, end_date=end_date, days=days)
                store_records(db, WeatherObservation, city.id, [row for row in weather_rows if row["timestamp"] <= now], "Open-Meteo weather")
            except Exception as exc:
                warning = f"Weather unavailable: {exc}"
        job.status = "completed_with_warnings" if warning else "completed"
        job.error_message = warning
        job.records_processed = count
        job.completed_at = datetime.now(UTC)
        db.commit()
        return {"records_processed": count, "warning": warning, "job_id": job.id}
    except Exception as exc:
        db.rollback()
        job = db.get(IngestionJob, job.id)
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = datetime.now(UTC)
        db.commit()
        raise
