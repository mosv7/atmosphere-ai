from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    database_url: str = "postgresql+psycopg://atmosphere:atmosphere@127.0.0.1:5433/atmosphere"
    cors_origins: str = "http://localhost:3000"
    scheduler_enabled: bool = True
    upstream_timeout: float = 30
    cache_ttl_seconds: int = 900
    model_artifact_dir: str = str(Path(__file__).resolve().parents[2] / "artifacts")


@lru_cache
def get_settings():
    return Settings()
