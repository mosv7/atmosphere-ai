# Atmosphere AI implementation plan

## Intent and design
Build the complete public environmental intelligence product described in the supplied master prompt: real data, genuine classical ML, eight connected screens, persistent PostgreSQL, reproducible collection/training and deployment. Autonomous execution is explicitly authorized.

The workspace is initially empty. Use Next.js App Router, FastAPI, SQLAlchemy/Alembic and PostgreSQL. Training is a separate CLI, never a web request. CAMS estimates are not station observations. Archived series support retrospective evaluation, not proof of historical issue-time availability; report that limitation explicitly. Use only lagged pollution and deterministic calendar/geographic features. Do not use future realized weather. Limit inference coverage to evaluated training locations initially; worldwide search/current data remain available.

## Interface contract
Backend port 8000; frontend 3000, browser calls same-origin `/api/*`, Next rewrites to backend. All timestamps UTC ISO8601 with timezone. All concentrations micrograms per cubic meter.

City: `{id: string, name, country, administrative_region, latitude, longitude, timezone}`. Default city Cairo. Backend seeds known coordinates only, never environmental values.

GET cities/search?q=: `{cities: City[]}`. GET cities: same. GET air-quality/current?city_id=: `{city, observation: {timestamp, pm25, pm10, no2, o3, so2, co}, weather: object|null, source, source_type, retrieved_at, age_hours, warnings}`. GET air-quality/history?city_id=&days= (1..365): `{city, records: observations[], source, source_type, units, warnings}`.

GET forecast/72h?city_id= and POST forecast/generate `{city_id}`: `{city, issued_at, observation_timestamp, model_version, model_family, units, source, coverage, warnings, uncertainty, values: [{timestamp,horizon_hours,predicted_pm25,lower_bound,upper_bound}]}`. Unsupported/untrained returns 409 with actionable detail, never invented forecasts.

GET models: `{models: [{version,model_name,training_date,metrics,metadata,active}]}`. GET models/metrics same or metadata leaderboard; GET models/feature-importance: `{features:[{feature,importance}],method,description}`. GET data/coverage: `{cities:[{city,records,start,end,missing_pm25,latest_ingestion}],source}`. GET system/status: honest live operational fields. GET analytics/city-comparison?city_ids= comma separated: `{cities:[current payload]}`. Additional analytics endpoints use stored real records. Errors `{detail: string}`.

## Tasks and ownership
1. Root: validate APIs/environment, initialize repository on codex/build-atmosphere-ai, document plan and design.
2. Backend implementer: backend app except app/ml, backend tests except ML, migrations, requirements. Coordinate ML adapter contract. API integration, normalized idempotent storage, caching/retries, scheduler, all routes.
3. ML implementer: backend/app/ml, ML tests, collect/train/evaluate CLI, real collection/training artifacts and metrics. Coordinate ORM access with backend. Six models/baselines; temporal purging, held-out city evaluation, test leakage. Metadata and artifact schema shared with backend.
4. Frontend implementer: frontend plus DESIGN.md and premium-ui.json. Eight routes, common shell/search, ECharts, MapLibre, shadcn primitives, themes, accessible loading/error states, real endpoints.
5. Root: infrastructure, environment scripts, documentation, PostgreSQL runtime, integration/E2E browser checks, review/fixes, complete checklist with evidence.

## Validation
Meaningful parser, timestamp, missingness, DB idempotence, error and endpoint tests; ML cutoff invariance, temporal purge, deterministic artifact inference and exactly 72 future timestamps. Frontend typecheck/lint/production build; real-browser search/history/inference/theme/mobile/API-failure flow. Live real-data collection, model training and saved artifact required. Validate Compose config; run containers if engine becomes available. No claims beyond executed evidence.

## Rulings
- Use current empty workspace directly as isolated new repository; no existing main or user changes to isolate.
- User explicitly instructs no approval stops; design/plan approval gates in skills are superseded by that instruction.
- Use subagent-driven development for independent backend, ML and UI tasks; integration and review remain coordinated here.
