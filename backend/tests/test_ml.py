"""Synthetic fixtures test mechanics only; training uses collected CAMS data."""
import numpy as np
import pandas as pd
import joblib
from datetime import timedelta

from app.ml.features import origin_features, forecast_features, build_examples, temporal_split
from app.ml.inference import predict_artifact


def history():
    times = pd.date_range('2025-01-01', periods=24 * 60, freq='h', tz='UTC')
    return pd.DataFrame({'timestamp': times, 'pm25': 15 + np.sin(np.arange(len(times)) / 24),
                         'pm10': 30., 'no2': 10., 'o3': 20., 'so2': 2., 'co': 200.,
                         'city_id': 'test', 'latitude': 30., 'longitude': 31.})


def test_features_are_invariant_to_future_pollution_and_weather():
    df = history()
    origin = df.timestamp.iloc[200]
    before = origin_features(df, origin)
    df.loc[df.timestamp > origin, 'pm25'] = 999999
    df['future_temperature'] = 1000
    assert before == origin_features(df, origin)
    assert not any('weather' in key or 'temperature' in key for key in before)
    assert before['pm25_lag_0'] == df.pm25.iloc[200]
    assert before['pm25_lag_24'] == df.pm25.iloc[176]


def test_future_features_have_exact_hourly_timestamps_and_schema():
    df = history()
    origin = df.timestamp.iloc[-1]
    x, timestamps = forecast_features(df, origin, 30., 31.)
    assert len(x) == len(timestamps) == 72
    assert timestamps[0] == origin + timedelta(hours=1)
    assert timestamps[-1] == origin + timedelta(hours=72)
    assert x.horizon_hours.tolist() == list(range(1, 73))
    assert np.isfinite(x.to_numpy()).all()


def test_missing_history_is_not_filled_from_future():
    df = history()
    df.loc[199, 'pm25'] = np.nan
    try:
        origin_features(df, df.timestamp.iloc[200])
    except ValueError as exc:
        assert 'history' in str(exc).lower()
    else:
        raise AssertionError('Incomplete origin history must be rejected')


def test_temporal_split_purges_all_targets_before_next_origin():
    df = history()
    examples = build_examples(df, origin_stride=24, horizons=(1, 6, 24, 72))
    train, validation, test = temporal_split(examples)
    assert len(train) and len(validation) and len(test)
    assert train.target_timestamp.max() < validation.origin.min()
    assert validation.target_timestamp.max() < test.origin.min()
    assert train.origin.max() + timedelta(hours=72) < validation.origin.min()
    assert validation.origin.max() + timedelta(hours=72) < test.origin.min()
    assert set(train.city_id) == {'test'}


def test_saved_estimator_roundtrip_and_nonnegative_predictions(tmp_path):
    from sklearn.dummy import DummyRegressor
    df = history()
    x, _ = forecast_features(df, df.timestamp.iloc[-1], 30., 31.)
    estimator = DummyRegressor(strategy='constant', constant=5).fit(x, np.ones(72))
    artifact = {'estimator': estimator, 'feature_schema': x.columns.tolist()}
    path = tmp_path / 'model.joblib'
    joblib.dump(artifact, path)
    first = predict_artifact(artifact, df, df.timestamp.iloc[-1], 30., 31.)
    second = predict_artifact(joblib.load(path), df, df.timestamp.iloc[-1], 30., 31.)
    assert first == second
    assert len(first) == 72
    assert all(row['predicted_pm25'] == 5 for row in first)


def test_seasonal_baseline_repeats_last_observed_day_at_long_horizons():
    df = history()
    examples = build_examples(df, origin_stride=100, horizons=(1, 24, 48, 72))
    first = examples[examples.origin == examples.origin.min()]
    origin = first.origin.iloc[0]
    index = df.set_index('timestamp')
    assert first[first.horizon_hours == 1].seasonal_naive.iloc[0] == index.loc[origin-timedelta(hours=23), 'pm25']
    for horizon in (24, 48, 72):
        assert first[first.horizon_hours == horizon].seasonal_naive.iloc[0] == index.loc[origin, 'pm25']


def test_stale_origin_refused_and_current_hour_yields_only_future_targets():
    from app.ml.inference import validate_origin
    import pytest
    issue = pd.Timestamp('2026-10-15T17:20:00Z')
    with pytest.raises(ValueError, match='current UTC hour'):
        validate_origin(pd.Timestamp('2026-10-15T16:00:00Z'), issue)
    origin = pd.Timestamp('2026-10-15T17:00:00Z')
    validate_origin(origin, issue)
    assert all(origin + timedelta(hours=h) > issue for h in range(1, 73))


def test_registry_cannot_load_mismatched_version():
    from app.ml.inference import validate_artifact_version
    import pytest
    with pytest.raises(ValueError, match='version'):
        validate_artifact_version({'metadata': {'version': 'old'}}, 'new')
    validate_artifact_version({'metadata': {'version': 'new'}}, 'new')


def test_unequal_history_never_grants_coverage_to_test_only_city():
    from app.ml.train import supported_cities
    full = history().iloc[:800]
    known = pd.concat([full.assign(city_id=city) for city in ('old-a', 'old-b', 'old-c')]
                      + [full.iloc[-168:].assign(city_id='new-city')], ignore_index=True)
    examples = build_examples(known, origin_stride=12, horizons=(1, 6, 24, 72))
    training, validation, test = temporal_split(examples)
    assert 'new-city' in set(test.city_id)
    assert 'new-city' not in set(training.city_id)
    assert supported_cities(training, validation, test, heldout_city='nairobi') == ['old-a', 'old-b', 'old-c']


def test_coverage_requires_three_fitted_evaluated_cities_and_excludes_heldout():
    import pytest
    from app.ml.train import supported_cities
    frame = pd.DataFrame({'city_id': ['a', 'b', 'nairobi']})
    with pytest.raises(ValueError, match='three'):
        supported_cities(frame, frame, frame, heldout_city='nairobi')
    full = pd.DataFrame({'city_id': ['a', 'b', 'c', 'nairobi']})
    assert supported_cities(full, full, full, heldout_city='nairobi') == ['a', 'b', 'c']
