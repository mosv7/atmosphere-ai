"""UTC, microgram/m³ adapters for Open-Meteo's CAMS and weather models."""
import asyncio
import math
import time
from datetime import UTC, date, datetime, timedelta
import httpx
from app.core.config import get_settings

AQ_FIELDS = {"pm2_5": "pm25", "pm10": "pm10", "nitrogen_dioxide": "no2", "ozone": "o3", "sulphur_dioxide": "so2", "carbon_monoxide": "co"}
WEATHER_FIELDS = {"temperature_2m": "temperature", "relative_humidity_2m": "humidity", "wind_speed_10m": "wind_speed", "wind_direction_10m": "wind_direction", "precipitation": "precipitation", "surface_pressure": "pressure"}
SOURCE = "Open-Meteo / CAMS"
SOURCE_TYPE = "model-derived estimate"
_cache: dict = {}
_locks = [asyncio.Lock() for _ in range(64)]
source_status: dict = {}


class SourceUnavailable(RuntimeError):
    pass


def parse_hourly(payload, fields):
    hourly = payload.get("hourly", {})
    times = hourly.get("time")
    if not isinstance(times, list):
        raise ValueError("Upstream response contains no hourly timestamps")
    units = payload.get("hourly_units", {})
    for upstream, field in fields.items():
        if upstream not in hourly or len(hourly[upstream]) != len(times):
            raise ValueError(f"Missing or misaligned upstream variable: {upstream}")
        if field in AQ_FIELDS.values() and units.get(upstream) not in ("μg/m³", "µg/m³", "μg/m3", "µg/m3"):
            raise ValueError(f"Unexpected concentration unit: {units.get(upstream)}")
    rows = {}
    for i, value in enumerate(times):
        stamp = datetime.fromisoformat(value)
        stamp = stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)
        row = {"timestamp": stamp}
        for upstream, field in fields.items():
            raw = hourly[upstream][i]
            row[field] = float(raw) if raw is not None and math.isfinite(float(raw)) and (float(raw) >= 0 or field == "temperature") else None
        rows[stamp] = row
    return [rows[key] for key in sorted(rows)]


def parse_source_hourly(payload, fields):
    try:
        return parse_hourly(payload, fields)
    except (ValueError, TypeError, KeyError) as exc:
        raise SourceUnavailable(f"Open-Meteo response schema is incompatible: {exc}") from exc


async def request_json(url, params):
    key = (url, tuple(sorted(params.items())))
    async with _locks[hash(key) % len(_locks)]:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < get_settings().cache_ttl_seconds:
            return cached[1]
        error = None
        async with httpx.AsyncClient(timeout=get_settings().upstream_timeout) as client:
            for attempt in range(3):
                try:
                    response = await client.get(url, params=params)
                    if response.status_code == 429 or response.status_code >= 500:
                        if attempt < 2:
                            retry = response.headers.get("Retry-After", "")
                            delay = min(float(retry), 10) if retry.isdigit() else 2 ** attempt
                            await asyncio.sleep(delay)
                            continue
                    response.raise_for_status()
                    data = response.json()
                    if data.get("error"):
                        raise ValueError(data.get("reason", "Unknown upstream error"))
                    _cache[key] = (time.monotonic(), data)
                    if len(_cache) > 512:
                        _cache.pop(next(iter(_cache)))
                    source_status[url] = {"available": True, "checked_at": datetime.now(UTC).isoformat()}
                    return data
                except (httpx.HTTPError, ValueError) as exc:
                    error = exc
                    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500 and exc.response.status_code != 429:
                        break
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)
        source_status[url] = {"available": False, "checked_at": datetime.now(UTC).isoformat(), "error": str(error)}
        raise SourceUnavailable(f"Open-Meteo request failed: {error}") from error


async def fetch_air_quality(city, start_date=None, end_date=None, days=7):
    params = {"latitude": city.latitude, "longitude": city.longitude, "hourly": ",".join(AQ_FIELDS), "timezone": "UTC"}
    if start_date is not None:
        params.update(start_date=str(start_date), end_date=str(end_date or date.today()))
    else:
        params.update(past_days=min(days, 92), forecast_days=1)
    data = await request_json("https://air-quality-api.open-meteo.com/v1/air-quality", params)
    return parse_source_hourly(data, AQ_FIELDS)


async def fetch_weather(city, start_date=None, end_date=None, days=7):
    params = {"latitude": city.latitude, "longitude": city.longitude, "hourly": ",".join(WEATHER_FIELDS), "timezone": "UTC", "wind_speed_unit": "ms"}
    if start_date is not None:
        start = date.fromisoformat(str(start_date))
        end = date.fromisoformat(str(end_date)) if end_date else datetime.now(UTC).date()
        archive_end = min(end, datetime.now(UTC).date() - timedelta(days=6))
        rows = []
        if start <= archive_end:
            data = await request_json("https://archive-api.open-meteo.com/v1/archive", {**params, "start_date": str(start), "end_date": str(archive_end)})
            rows.extend({**row, "source": "Open-Meteo historical weather reanalysis"} for row in parse_source_hourly(data, WEATHER_FIELDS))
        recent_start = max(start, archive_end + timedelta(days=1))
        if recent_start <= end:
            data = await request_json("https://api.open-meteo.com/v1/forecast", {**params, "start_date": str(recent_start), "end_date": str(end)})
            rows.extend({**row, "source": "Open-Meteo current weather estimate"} for row in parse_source_hourly(data, WEATHER_FIELDS))
        return rows
    data = await request_json("https://api.open-meteo.com/v1/forecast", {**params, "past_days": min(days, 92), "forecast_days": 1})
    return [{**row, "source": "Open-Meteo current weather estimate"} for row in parse_source_hourly(data, WEATHER_FIELDS)]


async def search_cities(query):
    data = await request_json("https://geocoding-api.open-meteo.com/v1/search", {"name": query, "count": 10, "language": "en", "format": "json"})
    return [{"id": f"geo-{row['id']}", "name": row["name"], "country": row.get("country", ""), "administrative_region": row.get("admin1"), "latitude": row["latitude"], "longitude": row["longitude"], "timezone": row.get("timezone", "UTC")} for row in data.get("results", [])]
