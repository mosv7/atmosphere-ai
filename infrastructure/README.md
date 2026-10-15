# Runtime

Compose manages PostgreSQL, FastAPI and Next.js. The backend runs Alembic before serving. Database, data files and model artifacts use named volumes. See docs/DEPLOYMENT.md for initialization and model training.

Local verification uses an independent PostgreSQL cluster under .runtime/postgres on port 5433. It does not change an existing PostgreSQL service or database.
