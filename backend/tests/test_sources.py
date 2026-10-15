from datetime import UTC
import pytest
from app.integrations.open_meteo import parse_hourly


def test_parser_preserves_missing_utc_and_last_duplicate():
    payload = {"hourly_units": {"pm2_5": "μg/m³"}, "hourly": {"time": ["2026-01-01T00:00", "2026-01-01T01:00", "2026-01-01T01:00"], "pm2_5": [None, 3, 4]}}
    records = parse_hourly(payload, {"pm2_5": "pm25"})
    assert len(records) == 2
    assert records[0]["timestamp"].tzinfo == UTC
    assert records[0]["pm25"] is None
    assert records[1]["pm25"] == 4


def test_parser_rejects_wrong_units_and_misaligned_columns():
    with pytest.raises(ValueError):
        parse_hourly({"hourly_units": {"pm2_5": "ppm"}, "hourly": {"time": ["2026-01-01T00:00"], "pm2_5": [1]}}, {"pm2_5": "pm25"})
    with pytest.raises(ValueError):
        parse_hourly({"hourly_units": {"pm2_5": "μg/m³"}, "hourly": {"time": ["2026-01-01T00:00"], "pm2_5": []}}, {"pm2_5": "pm25"})


@pytest.mark.asyncio
async def test_upstream_schema_drift_is_source_unavailable(monkeypatch):
    from app.integrations import open_meteo
    from types import SimpleNamespace
    async def request(*args):
        return {"hourly": {"time": []}}
    monkeypatch.setattr(open_meteo, "request_json", request)
    with pytest.raises(open_meteo.SourceUnavailable):
        await open_meteo.fetch_air_quality(SimpleNamespace(latitude=30, longitude=31))
