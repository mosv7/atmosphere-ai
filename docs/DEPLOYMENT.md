# Setup and deployment

## Docker Compose

Requires Docker Desktop with its Linux engine running (or a Linux Docker engine), Compose, and internet access to the source/tiles/package registries. Ports 3000, 8000 and 5433 must be free.

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose exec backend python -m app.ml.collect_data --days 365
docker compose exec backend python -m app.ml.train
docker compose exec backend python -m app.ml.evaluate --recompute
```

Open http://localhost:3000 and API documentation http://localhost:8000/docs. The web UI works before training for source data and reports the missing model; training enables own-model forecasts. Collection and training are operator CLI tasks, not public endpoints.

Compose starts PostgreSQL, applies Alembic migrations in the backend, waits for database/API readiness, and starts the frontend. The image uses a locked Python dependency set and npm's lockfile. Frontend rewrites are compiled with `BACKEND_URL=http://backend:8000`; if you change this topology, rebuild the frontend image. Browser requests remain same-origin.

Database, model artifacts and collected files use named volumes. This preserves the image's non-root directory permissions on a fresh Linux installation. Keep all volumes with database backups. To export a container's artifacts, use `docker compose cp backend:/app/artifacts ./exported-artifacts`. Never remove volumes as a routine restart. `docker compose stop` preserves all data. A clean clone has no pretrained model; run the commands above instead of expecting fabricated forecasts.

To use different host ports, set `POSTGRES_PORT`, `BACKEND_PORT` and `FRONTEND_PORT` before Compose. Example (PowerShell):

```powershell
$env:POSTGRES_PORT='5543'
$env:BACKEND_PORT='18000'
$env:FRONTEND_PORT='13000'
docker compose -p atmosphere-verify up --build -d
```

Each Compose project receives distinct database and artifact volumes. Native development artifacts remain under `backend/artifacts`; they are independent of container volumes.

## Native Windows development

Verified environment: Python 3.13.6, Node 24.13.1, PostgreSQL 18.2. Python 3.12+ is the application floor; the provided lock was executed on 3.13. Use Node 24 for the supplied Next.js version. PostgreSQL binaries need not be on PATH when using the script.

```powershell
.\scripts\start-local.ps1 -Install -BuildFrontend
```

The script initializes a separate local cluster in `.runtime/postgres`, binds it to 127.0.0.1:5433, creates only the `atmosphere` database in that cluster, migrates it, builds Next.js and starts the API/web server hidden with logs in `.runtime`. It does not change an existing PostgreSQL service. Pass `-PostgresBin` for a different installation directory. The template password is strictly a local development default; use deployment secrets for hosted databases.

After setup, collect/train from `backend`:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.ml.collect_data --days 365
..\.venv\Scripts\python.exe -m app.ml.train
..\.venv\Scripts\python.exe -m app.ml.evaluate --recompute
```

For development with visible terminals:

```powershell
# Terminal 1, repository root
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# Terminal 2, repository root
cd frontend
npm ci
npm run dev -- --hostname 127.0.0.1
```

Use http://127.0.0.1:3000. `.env.example` documents database, backend proxy and CORS defaults. Backend settings load root `.env` when invoked from `backend`.

## Tests and maintenance

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check
cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
```

For reproducible retraining, keep the PostgreSQL source snapshot, versioned artifact directory and exact dependency lock. `evaluate --recompute` reuses saved predictions, so it does not depend on upstream data revisions.

Compose uses a dedicated network, default `172.30.81.0/24`, and Uvicorn trusts forwarded client addresses only within that network. Set `ATMOSPHERE_NETWORK_SUBNET` to a free CIDR if it overlaps another network, or when running multiple copies. Next.js forwards client information to the API. An internet-facing reverse proxy must strip client-supplied forwarding headers and supply authoritative addresses; untrusted forwarding headers are not an identity system.

Use one backend worker with the built-in scheduler. Before public deployment, configure HTTPS at a reverse proxy, deployment secrets, edge rate limiting, backups, resource limits and the appropriate commercial data access where needed. Do not expose operator artifact directories or database ports publicly. The default Compose ports bind to loopback.

Actual build/container/browser verification and its limits are in `IMPLEMENTATION_STATUS.md`; a configured deployment is not automatically a tested deployment.
