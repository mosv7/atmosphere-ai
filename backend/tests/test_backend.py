from datetime import UTC, datetime, timedelta
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.db.session import Base, get_db
from app.main import app
from app.models import AirQualityObservation, City
from app.services.ingestion import seed_cities, store_records
from app.integrations import open_meteo


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        seed_cities(session)
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    client.close()
    app.dependency_overrides.clear()


def test_idempotent_corrected_values_preserve_missingness(db):
    stamp = datetime(2026, 1, 1, tzinfo=UTC)
    row = {"timestamp": stamp, "pm25": 5.0, "pm10": None, "no2": None, "o3": None, "so2": None, "co": None}
    store_records(db, AirQualityObservation, "cairo", [row], open_meteo.SOURCE)
    store_records(db, AirQualityObservation, "cairo", [{**row, "pm25": 7.0}], open_meteo.SOURCE)
    db.commit()
    assert db.scalar(select(func.count()).select_from(AirQualityObservation)) == 1
    record = db.scalar(select(AirQualityObservation))
    assert record.pm25 == 7
    assert record.pm10 is None
    assert record.source_type == "model-derived estimate"


def test_validation_health_unknown_city_and_empty_registry(client):
    assert client.get("/api/health").json()["database"] == "connected"
    assert len(client.get("/api/cities").json()["cities"]) == 8
    assert client.get("/api/air-quality/history?days=366").status_code == 422
    assert client.get("/api/cities/search?q=x").status_code == 422
    assert client.get("/api/air-quality/current?city_id=not-known").status_code == 404
    assert client.get("/api/models").json() == {"models": []}
    assert client.get("/api/analytics/city-comparison?city_ids=cairo").status_code == 422


def test_current_degrades_to_stored_real_records(client, db, monkeypatch):
    async def unavailable(*args, **kwargs):
        raise open_meteo.SourceUnavailable("upstream down")
    monkeypatch.setattr("app.api.routes.ingest_city", unavailable)
    stamp = datetime.now(UTC) - timedelta(hours=8)
    store_records(db, AirQualityObservation, "cairo", [{"timestamp": stamp, "pm25": 12, "pm10": None, "no2": None, "o3": None, "so2": None, "co": None}], open_meteo.SOURCE)
    db.commit()
    response = client.get("/api/air-quality/current")
    assert response.status_code == 200
    data = response.json()
    assert data["observation"]["pm25"] == 12
    assert data["observation"]["pm10"] is None
    assert any("stored data" in warning for warning in data["warnings"])
    assert data["age_hours"] >= 8
    assert client.get("/api/data/coverage").json()["cities"][0]["records"] == 1


@pytest.mark.asyncio
async def test_transient_retry_cache_and_terminal_error(monkeypatch):
    calls = []
    async def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"results": []})
    original = httpx.AsyncClient
    monkeypatch.setattr(open_meteo.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    open_meteo._cache.clear()
    await open_meteo.request_json("https://example.org/test", {"q": "retry"})
    await open_meteo.request_json("https://example.org/test", {"q": "retry"})
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_ingestion_excludes_future_and_records_weather_failure(db, monkeypatch):
    now = datetime.now(UTC)
    async def aq(*args, **kwargs):
        return [{"timestamp": now - timedelta(hours=1), "pm25": 3}, {"timestamp": now + timedelta(hours=1), "pm25": 999}]
    async def weather(*args, **kwargs):
        raise open_meteo.SourceUnavailable("weather unavailable")
    monkeypatch.setattr("app.services.ingestion.fetch_air_quality", aq)
    monkeypatch.setattr("app.services.ingestion.fetch_weather", weather)
    from app.services.ingestion import ingest_city
    response = await ingest_city(db, db.get(City, "cairo"))
    assert response["records_processed"] == 1
    assert response["warning"]
    assert db.scalar(select(AirQualityObservation.pm25)) == 3


@pytest.mark.asyncio
async def test_weather_archive_and_recent_requests_cover_requested_window(monkeypatch):
    requests = []
    from datetime import date
    async def request(url, params):
        requests.append((url, params))
        return {"hourly": {"time": [], **{name: [] for name in open_meteo.WEATHER_FIELDS}}}
    monkeypatch.setattr(open_meteo, "request_json", request)
    city = City(latitude=30, longitude=31)
    start = datetime.now(UTC).date() - timedelta(days=365)
    end = datetime.now(UTC).date()
    await open_meteo.fetch_weather(city, start_date=start, end_date=end)
    assert len(requests) == 2
    assert requests[0][1]["start_date"] == str(start)
    assert date.fromisoformat(requests[0][1]["end_date"]) + timedelta(days=1) == date.fromisoformat(requests[1][1]["start_date"])
    assert requests[1][1]["end_date"] == str(end)


def test_no_model_forecast_returns_actionable_conflict(client, monkeypatch):
    async def no_refresh(*args, **kwargs):
        return []
    monkeypatch.setattr("app.api.routes.refresh", no_refresh)
    response = client.get("/api/forecast/72h")
    assert response.status_code == 409
    assert "train" in response.json()["detail"]


def test_forecasts_persist_and_cache_full_72_hours(client, db, monkeypatch):
    from app.models import ModelRegistry, ForecastRun, ForecastValue
    now = datetime.now(UTC)
    calls = []
    async def no_refresh(*args, **kwargs):
        return []
    def inference(*args):
        calls.append(True)
        return {"issued_at": now.isoformat(), "observation_timestamp": now.replace(minute=0, second=0, microsecond=0).isoformat(), "model_version": "unit-test", "model_family": "fixture", "values": [{"timestamp": (now + timedelta(hours=h)).isoformat(), "horizon_hours": h, "predicted_pm25": float(h)} for h in range(1, 73)]}
    db.add(ModelRegistry(version="unit-test", model_name="fixture", artifact_path="unused", active=True))
    db.commit()
    monkeypatch.setattr("app.api.routes.refresh", no_refresh)
    monkeypatch.setattr("app.ml.inference.generate_forecast", inference)
    first = client.get("/api/forecast/72h")
    second = client.get("/api/forecast/72h")
    assert first.status_code == second.status_code == 200
    assert len(first.json()["values"]) == 72
    assert len(calls) == 1
    assert db.scalar(select(func.count()).select_from(ForecastRun)) == 1
    assert db.scalar(select(func.count()).select_from(ForecastValue)) == 72


@pytest.mark.asyncio
async def test_crossing_hour_refreshes_recent_but_previous_hour_observation(db, monkeypatch):
    from app.api.routes import refresh
    now = datetime.now(UTC)
    previous_hour = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    rows = [{"timestamp": previous_hour - timedelta(hours=h), "pm25": 3} for h in range(169)]
    store_records(db, AirQualityObservation, "cairo", rows, open_meteo.SOURCE)
    db.commit()
    calls = []
    async def ingestion(*args, **kwargs):
        calls.append(True)
        return {}
    monkeypatch.setattr("app.api.routes.ingest_city", ingestion)
    await refresh(db, db.get(City, "cairo"), 7)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_forecast_previous_hour_origin_never_reused_across_hour(db, monkeypatch):
    from app.api.routes import make_forecast
    from app.models import ForecastRun, ModelRegistry
    from fastapi import HTTPException
    now = datetime.now(UTC)
    previous_hour = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    db.add(ModelRegistry(version="cross-hour", model_name="fixture", artifact_path="unused", active=True))
    db.add(ForecastRun(city_id="cairo", model_version="cross-hour", issued_at=now - timedelta(minutes=1), source_data_timestamp=previous_hour, response_json={"cached": "invalid"}))
    db.commit()
    calls = []
    async def no_refresh(*args, **kwargs):
        return []
    def inference(*args):
        calls.append(True)
        raise ValueError("New hour requires fresh data")
    monkeypatch.setattr("app.api.routes.refresh", no_refresh)
    monkeypatch.setattr("app.ml.inference.generate_forecast", inference)
    with pytest.raises(HTTPException) as error:
        await make_forecast("cairo", db)
    assert error.value.status_code == 409
    assert len(calls) == 1


def test_costly_endpoints_are_rate_limited(client, monkeypatch):
    from app.core.rate_limit import limiter
    limiter.clear()
    responses = [client.post("/api/forecast/generate", json={"city_id": "not-known"}) for _ in range(7)]
    assert responses[-1].status_code == 429
    assert responses[-1].headers["retry-after"]
    limiter.clear()


def test_map_snapshot_exact_cutoff_partial_missing_and_validation(client, db, monkeypatch):
    from app.api import routes
    fixed = datetime(2026, 10, 15, 17, 30, tzinfo=UTC)
    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed
    monkeypatch.setattr(routes, "datetime", FixedDatetime)
    calls = []
    async def refresh(db, city, days):
        calls.append((city.id, days))
        return []
    monkeypatch.setattr(routes, "refresh", refresh)
    cutoff = fixed - timedelta(hours=24)
    store_records(db, AirQualityObservation, "cairo", [{"timestamp": cutoff - timedelta(hours=1), "pm25": 11}, {"timestamp": cutoff, "pm25": 22}, {"timestamp": cutoff + timedelta(minutes=1), "pm25": 99}], open_meteo.SOURCE)
    db.commit()
    response = client.get("/api/analytics/map-snapshot?city_ids=cairo,london&hours_ago=24")
    assert response.status_code == 200
    data = response.json()
    assert datetime.fromisoformat(data["target_timestamp"]) == cutoff
    assert data["cities"][0]["observation"]["pm25"] == 22
    assert data["cities"][0]["observation"]["timestamp"].startswith("2026-10-14T17:30")
    assert data["cities"][0]["age_hours"] == 24
    assert "as-issued" in data["cities"][0]["warnings"][0]
    assert "error" in data["cities"][1]
    assert calls == [("cairo", 7), ("london", 7)]
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo&hours_ago=-1").status_code == 422
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo&hours_ago=2161").status_code == 422
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo,cairo").status_code == 422
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo,london,delhi,tokyo,sydney,nairobi").status_code == 422
    assert client.get("/api/analytics/map-snapshot?city_ids=unknown").status_code == 404
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo&hours_ago=2160").status_code == 200
    assert calls[-1] == ("cairo", 92)
    assert client.get("/api/analytics/map-snapshot?city_ids=cairo&hours_ago=0").status_code == 200
    assert calls[-1] == ("cairo", 7)
    from fastapi import HTTPException
    async def unavailable(*args):
        raise HTTPException(503, "Source unavailable")
    monkeypatch.setattr(routes, "refresh", unavailable)
    degraded = client.get("/api/analytics/map-snapshot?city_ids=cairo,london&hours_ago=24").json()
    assert degraded["cities"][0]["observation"]["pm25"] == 22
    assert "Source unavailable" in degraded["cities"][0]["warnings"]
    assert "error" in degraded["cities"][1]
