"""Features available at an origin; never consume future pollution or weather."""
from __future__ import annotations
from datetime import timedelta

import numpy as np
import pandas as pd

HORIZONS = tuple(range(1, 73))
LAGS = (0, 1, 3, 6, 12, 24, 48, 72)
POLLUTANTS = ('pm25', 'pm10', 'no2', 'o3', 'so2', 'co')


def utc(value):
    value = pd.Timestamp(value)
    return value.tz_localize('UTC') if value.tzinfo is None else value.tz_convert('UTC')


def normalized_history(frame):
    result = frame.copy()
    result['timestamp'] = pd.to_datetime(result['timestamp'], utc=True)
    return result.sort_values('timestamp').drop_duplicates('timestamp', keep='last')


def origin_features(frame, origin):
    origin = utc(origin)
    indexed = normalized_history(frame).set_index('timestamp')
    expected = pd.date_range(origin - timedelta(hours=72), origin, freq='h')
    past = indexed.reindex(expected)
    values = pd.to_numeric(past.pm25, errors='coerce')
    if len(values) != 73 or not np.isfinite(values.to_numpy()).all():
        raise ValueError('73 consecutive hours of nonmissing PM2.5 history are required')
    features = {f'pm25_lag_{lag}': float(values.iloc[-1-lag]) for lag in LAGS}
    for window in (6, 24, 72):
        recent = values.iloc[-window:]
        for name, value in [('mean', recent.mean()), ('std', recent.std(ddof=0)),
                            ('min', recent.min()), ('max', recent.max())]:
            features[f'pm25_{name}_{window}h'] = float(value)
    features['pm25_trend_6h'] = float(values.iloc[-1] - values.iloc[-7]) / 6
    # Missing non-target pollutant inputs are represented explicitly. No interpolation.
    for pollutant in POLLUTANTS[1:]:
        value = past[pollutant].iloc[-1] if pollutant in past else np.nan
        valid = pd.notna(value) and np.isfinite(float(value))
        features[f'{pollutant}_current'] = float(value) if valid else 0.
        features[f'{pollutant}_missing'] = float(not valid)
    return features


def target_features(base, origin, horizon, latitude, longitude):
    target = utc(origin) + timedelta(hours=int(horizon))
    return {**base, 'latitude': float(latitude), 'longitude': float(longitude),
            'horizon_hours': int(horizon),
            'target_hour_sin': np.sin(2 * np.pi * target.hour / 24),
            'target_hour_cos': np.cos(2 * np.pi * target.hour / 24),
            'target_weekday_sin': np.sin(2 * np.pi * target.dayofweek / 7),
            'target_weekday_cos': np.cos(2 * np.pi * target.dayofweek / 7),
            'target_year_sin': np.sin(2 * np.pi * target.dayofyear / 365.25),
            'target_year_cos': np.cos(2 * np.pi * target.dayofyear / 365.25),
            'target_weekend': float(target.dayofweek >= 5)}


def forecast_features(frame, origin, latitude, longitude):
    base = origin_features(frame, origin)
    timestamps = [utc(origin) + timedelta(hours=h) for h in HORIZONS]
    return pd.DataFrame([target_features(base, origin, h, latitude, longitude) for h in HORIZONS]), timestamps


def build_examples(frame, origin_stride=12, horizons=HORIZONS):
    """Rolling origins; target labels are stored separately from feature columns."""
    result = []
    for city_id, city_frame in frame.groupby('city_id', sort=True):
        city_frame = normalized_history(city_frame)
        indexed = city_frame.set_index('timestamp')
        latitude, longitude = city_frame.iloc[0][['latitude', 'longitude']]
        for origin in city_frame.timestamp.iloc[72:-72:origin_stride]:
            try:
                base = origin_features(city_frame, origin)
            except ValueError:
                continue
            for horizon in horizons:
                target = origin + timedelta(hours=int(horizon))
                if target not in indexed.index or pd.isna(indexed.loc[target, 'pm25']):
                    continue
                # Repeating the last observed daily cycle never reads beyond origin.
                seasonal_time = origin + timedelta(hours=((int(horizon) - 1) % 24) - 23)
                seasonal = indexed.loc[seasonal_time, 'pm25']
                result.append({**target_features(base, origin, horizon, latitude, longitude),
                               'origin': origin, 'target_timestamp': target, 'city_id': city_id,
                               'target': float(indexed.loc[target, 'pm25']),
                               'persistence': base['pm25_lag_0'], 'seasonal_naive': float(seasonal)})
    if not result:
        raise ValueError('No complete origin/target windows available; collect at least 30 days')
    return pd.DataFrame(result)


NON_FEATURES = {'origin', 'target_timestamp', 'city_id', 'target', 'persistence', 'seasonal_naive'}


def feature_columns(examples):
    return [c for c in examples.columns if c not in NON_FEATURES]


def temporal_split(examples, validation_start=None, test_start=None):
    """Purged chronological split: every previous target precedes next period's first origin."""
    origins = examples.origin.sort_values().unique()
    if len(origins) < 20:
        raise ValueError('Too few rolling origins for chronological evaluation')
    validation_start = utc(validation_start) if validation_start is not None else pd.Timestamp(origins[int(len(origins)*.65)])
    test_start = utc(test_start) if test_start is not None else pd.Timestamp(origins[int(len(origins)*.82)])
    train = examples[examples.origin + timedelta(hours=72) < validation_start]
    validation = examples[(examples.origin >= validation_start) & (examples.origin + timedelta(hours=72) < test_start)]
    test = examples[examples.origin >= test_start]
    if min(len(train), len(validation), len(test)) == 0:
        raise ValueError('Training window too short after 72-hour temporal purging')
    return train.copy(), validation.copy(), test.copy()
