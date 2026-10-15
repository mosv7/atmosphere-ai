# API

Interactive OpenAPI: http://127.0.0.1:8000/docs ; machine schema: `/openapi.json`.
Frontend requests use same-origin `/api`; direct backend clients use port 8000.

| Method | Path | Parameters / behavior |
|---|---|---|
| GET | `/api/health` | Database-backed readiness; errors return 503 |
| GET | `/api/cities` | Stored locations, including seed and searched cities |
| GET | `/api/cities/search` | `q` 2–100 chars; actual geocoding, stable city IDs |
| GET | `/api/air-quality/current` | `city_id` default cairo; latest valid source estimate, weather, provenance/freshness |
| GET | `/api/air-quality/history` | `city_id`, `days` 1–365; actual stored/refreshed hourly values |
| GET | `/api/forecast/72h` | `city_id`; cached genuine model prediction, 409 if no supported active model |
| POST | `/api/forecast/generate` | JSON `{"city_id":"cairo"}`; generate and persist run |
| GET | `/api/models` | Registered model versions and actual evaluation metadata |
| GET | `/api/models/metrics` | Same model registrations with comparison metadata |
| GET | `/api/models/feature-importance` | Actual global validation permutation importance; not causal |
| GET | `/api/data/coverage` | Per-city counts, coverage, gaps, missing PM2.5, last ingestion |
| GET | `/api/analytics/city-comparison` | `city_ids=cairo,london`, 2–5 distinct stored IDs; per-city partial failures |
| GET | `/api/analytics/map-snapshot` | `city_ids` 1–5 distinct stored IDs, `hours_ago` 0–2160; actual latest record before selected cutoff, per-city missingness and gap warnings |
| GET | `/api/analytics/patterns` | `city_id`, `days`; hourly PM2.5 patterns and window-based anomalies |
| GET | `/api/system/status` | DB, source check results, real last ingestion/run, active model, scheduler |

Concentrations are µg/m³, timestamps are offset-aware ISO8601 representing UTC instants. Weather wind speed is m/s. Null means missing, never zero. City metadata includes its timezone for local rendering. Historical source values are model-derived estimates; prediction responses identify the locally trained estimator and its version separately.

Prediction responses carry `issued_at`, `observation_timestamp`, `model_version`, `model_family`, `coverage`, `data_age_hours`, `warnings`, `uncertainty` and 72 `values`. Each value has `timestamp`, `horizon_hours`, `predicted_pm25` and nullable interval bounds. Coverage and source freshness can prevent forecasting while current/history remain accessible.

Errors use `detail` and appropriate status: 404 unknown city/data, 409 model/coverage/freshness limitation, 422 invalid request, 429 rate limit with Retry-After, 503 upstream/database unavailable. FastAPI validation details may be an array. Clients should preserve useful stored content and show actionable retry controls.

See the generated OpenAPI document for authoritative request shapes. Endpoints suggested in the original brief are consolidated where they share data: patterns/history provide pollutant and trend analysis rather than duplicate routes.
