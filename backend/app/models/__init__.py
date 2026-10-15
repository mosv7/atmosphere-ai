from datetime import UTC, datetime
from uuid import uuid4
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


def utcnow():
    return datetime.now(UTC)


class City(Base):
    __tablename__ = "cities"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    country: Mapped[str] = mapped_column(String(150))
    administrative_region: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")


class AirQualityObservation(Base):
    __tablename__ = "air_quality_observations"
    __table_args__ = (UniqueConstraint("city_id", "timestamp", "source", name="uq_aq_city_time_source"), Index("ix_aq_city_time", "city_id", "timestamp"))
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    pm25: Mapped[float | None] = mapped_column(Float, nullable=True)
    pm10: Mapped[float | None] = mapped_column(Float, nullable=True)
    no2: Mapped[float | None] = mapped_column(Float, nullable=True)
    o3: Mapped[float | None] = mapped_column(Float, nullable=True)
    so2: Mapped[float | None] = mapped_column(Float, nullable=True)
    co: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="Open-Meteo / CAMS")
    source_type: Mapped[str] = mapped_column(String(100), default="model-derived estimate")
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WeatherObservation(Base):
    __tablename__ = "weather_observations"
    __table_args__ = (UniqueConstraint("city_id", "timestamp", "source", name="uq_weather_city_time_source"), Index("ix_weather_city_time", "city_id", "timestamp"))
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction: Mapped[float | None] = mapped_column(Float, nullable=True)
    precipitation: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="Open-Meteo weather")
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ModelRegistry(Base):
    __tablename__ = "model_registry"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(150), unique=True)
    model_name: Mapped[str] = mapped_column(String(100))
    training_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    feature_schema: Mapped[list] = mapped_column(JSON, default=list)
    evaluation_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    artifact_path: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class ForecastRun(Base):
    __tablename__ = "forecast_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    city_id: Mapped[str] = mapped_column(ForeignKey("cities.id"), index=True)
    model_version: Mapped[str] = mapped_column(String(150))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    source_data_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="completed")
    response_json: Mapped[dict] = mapped_column(JSON, default=dict)


class ForecastValue(Base):
    __tablename__ = "forecast_values"
    __table_args__ = (UniqueConstraint("forecast_run_id", "horizon_hours", name="uq_forecast_horizon"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    forecast_run_id: Mapped[str] = mapped_column(ForeignKey("forecast_runs.id", ondelete="CASCADE"), index=True)
    target_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    horizon_hours: Mapped[int] = mapped_column(Integer)
    predicted_pm25: Mapped[float] = mapped_column(Float)
    lower_bound: Mapped[float | None] = mapped_column(Float, nullable=True)
    upper_bound: Mapped[float | None] = mapped_column(Float, nullable=True)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[str | None] = mapped_column(ForeignKey("cities.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="Open-Meteo")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="running")
    records_processed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
