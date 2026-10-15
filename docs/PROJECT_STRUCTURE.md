# Project structure

- `frontend/app`: Next.js App Router pages and shared layout.
- `frontend/components`: navigation, search, charts, map and shared interface primitives.
- `frontend/lib`: typed API access and data formatting.
- `backend/app/core`: environment configuration.
- `backend/app/db`: SQLAlchemy engine/session.
- `backend/app/models`: database entities and uniqueness/index contracts.
- `backend/app/integrations`: Open-Meteo request/parsing adapters.
- `backend/app/services`: ingestion, data queries and forecast orchestration.
- `backend/app/ml`: feature engineering, collection, training, evaluation and inference.
- `backend/alembic`: database migrations.
- `backend/tests`: parser, storage, API and ML checks.
- `backend/data`: ignored real collected datasets.
- `backend/artifacts`: ignored native trained artifacts and reports; containers use a separate named volume.
- `infrastructure`: runtime notes.
- `docs`: methodology, provenance, deployment, limitations and executed verification.
- `.runtime`: ignored local database cluster, logs and development evidence.

See `IMPLEMENTATION_PLAN.md` for task ownership and the API contract, `BUILD_SPEC.md` for the original full requirements, and `IMPLEMENTATION_STATUS.md` for current evidence.
