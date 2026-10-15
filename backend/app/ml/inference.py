from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from app.ml.features import forecast_features, utc


@lru_cache(maxsize=4)
def load_artifact(path: str, modified: float):
    # Only operator-created local artifacts are loaded. Never accept upload paths.
    return joblib.load(path)


def validate_origin(origin, issued_at):
    if utc(origin) < utc(issued_at).floor('h'):
        raise ValueError('Latest pollution history does not reach the current UTC hour; refresh ingestion before forecasting 72 future hours.')
    if utc(origin) > utc(issued_at):
        raise ValueError('Pollution origin lies after forecast issue time')


def validate_artifact_version(artifact, expected_version):
    if artifact.get('metadata', {}).get('version') != expected_version:
        raise ValueError('Model artifact version does not match the active registry; restore the registered immutable artifact.')


def predict_artifact(artifact, history, origin, latitude, longitude):
    x, timestamps = forecast_features(history, origin, latitude, longitude)
    schema = artifact['feature_schema']
    if set(schema) != set(x.columns):
        raise ValueError('Model feature schema is incompatible with current inference')
    predictions = np.maximum(0, artifact['estimator'].predict(x[schema]))
    if not np.isfinite(predictions).all():
        raise ValueError('Model returned invalid predictions')
    return [{'timestamp': timestamp.isoformat(), 'horizon_hours': h,
             'predicted_pm25': float(value), 'lower_bound': None, 'upper_bound': None}
            for h, timestamp, value in zip(range(1, 73), timestamps, predictions)]


def generate_forecast(db, city):
    from sqlalchemy import select
    from app.models import AirQualityObservation, ModelRegistry
    registry = db.scalar(select(ModelRegistry).where(ModelRegistry.active.is_(True)).order_by(ModelRegistry.training_date.desc()))
    if registry is None:
        raise ValueError('No trained model is active. Run python -m app.ml.train after collecting history.')
    metadata = registry.metadata_json
    if city.id not in metadata.get('supported_city_ids', []):
        raise ValueError('Forecast coverage is limited to evaluated training cities. Current and historical data remain available for this city.')
    path = Path(registry.artifact_path)
    if not path.exists():
        raise ValueError('Active model artifact is missing. Restore it or rerun training.')
    now = datetime.now(UTC)
    # Hourly estimates strictly at/before actual issue time, excluding upstream forecast rows.
    records = db.scalars(select(AirQualityObservation).where(
        AirQualityObservation.city_id == city.id,
        AirQualityObservation.timestamp <= now,
        AirQualityObservation.timestamp >= now - timedelta(days=7),
    ).order_by(AirQualityObservation.timestamp)).all()
    if not records:
        raise ValueError('No recent pollution history. Refresh city ingestion before forecasting.')
    history = pd.DataFrame([{key: getattr(row, key) for key in ('timestamp', 'pm25', 'pm10', 'no2', 'o3', 'so2', 'co')} for row in records])
    origin = utc(history.timestamp.max())
    age = (utc(now) - origin).total_seconds() / 3600
    validate_origin(origin, now)
    artifact = load_artifact(str(path.resolve()), path.stat().st_mtime)
    validate_artifact_version(artifact, registry.version)
    values = predict_artifact(artifact, history, origin, city.latitude, city.longitude)
    return {'city': {key: getattr(city, key) for key in ('id', 'name', 'country', 'administrative_region', 'latitude', 'longitude', 'timezone')},
            'issued_at': now.isoformat(), 'observation_timestamp': origin.isoformat(),
            'model_version': registry.version, 'model_family': registry.model_name,
            'units': 'µg/m³', 'source': 'Atmosphere AI trained classical ML; inputs Open-Meteo / CAMS estimates',
            'coverage': 'Evaluated training cities only; held-out-city accuracy reported separately',
            'warnings': [
                'Inputs and evaluation targets are model-derived CAMS estimates, not station observations.',
                'Backtesting uses retrospectively retrieved archives; historical issue-time availability is not established.',
                'Prediction intervals are unavailable: independent uncertainty calibration has not been completed.',
                'Forecast hours are relative to the current UTC-hour estimate; all target timestamps follow issue time.',
            ], 'uncertainty': None, 'data_age_hours': round(age, 2), 'values': values}
