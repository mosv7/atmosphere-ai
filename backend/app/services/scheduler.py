import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import City, ModelRegistry
from app.services.ingestion import SEED_CITIES, ingest_city

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


async def refresh_known_cities():
    from app.api.routes import make_forecast
    with SessionLocal() as db:
        for city in db.scalars(select(City).where(City.id.in_([row[0] for row in SEED_CITIES]))).all():
            try:
                await ingest_city(db, city, days=7)
                if db.scalar(select(ModelRegistry).where(ModelRegistry.active.is_(True)).limit(1)):
                    try:
                        await make_forecast(city.id, db)
                    except Exception as exc:
                        logger.info("forecast_refresh_skipped", extra={"city": city.id, "reason": str(exc)})
            except Exception:
                logger.exception("scheduled_ingestion_failed", extra={"city": city.id})


def start_scheduler():
    scheduler.add_job(refresh_known_cities, "interval", hours=3, id="refresh-observations", max_instances=1, coalesce=True, replace_existing=True)
    scheduler.start()
