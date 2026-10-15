import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from app.api.routes import router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import seed_cities
from app.services.scheduler import scheduler, start_scheduler
from app.core.rate_limit import limiter


class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"level": record.levelname, "logger": record.name, "message": record.getMessage(), "exception": self.formatException(record.exc_info) if record.exc_info else None})


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])


@asynccontextmanager
async def lifespan(app):
    with SessionLocal() as db:
        seed_cities(db)
    if get_settings().scheduler_enabled:
        start_scheduler()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Atmosphere AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins.split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
app.include_router(router, prefix="/api")


@app.middleware("http")
async def limit_costly_requests(request: Request, call_next):
    path = request.url.path
    limit = 6 if path == "/api/forecast/generate" else 30 if path == "/api/cities/search" else 120 if path.startswith("/api/") and path != "/api/health" else None
    if limit:
        retry = limiter.allow((request.client.host if request.client else "unknown", path), limit)
        if retry:
            return JSONResponse(status_code=429, content={"detail": "Request limit exceeded. Retry shortly."}, headers={"Retry-After": str(retry)})
    return await call_next(request)


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logging.getLogger(__name__).exception("database_request_failed")
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Check service connectivity and migrations."})
