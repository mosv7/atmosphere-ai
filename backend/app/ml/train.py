"""Train and compare real classical estimators on purged chronological CAMS data."""
from __future__ import annotations

import argparse
from datetime import UTC, datetime
import hashlib
import importlib.metadata
import json
from pathlib import Path
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from lightgbm import LGBMRegressor
from xgboost import XGBRegressor
import optuna

from app.ml.features import build_examples, feature_columns, temporal_split
from app.ml.evaluate import detailed_metrics, metrics

TRAIN_HORIZONS = (1, 3, 6, 12, 18, 24, 36, 48, 60, 72)
SEED = 42


def supported_cities(training, validation, test, heldout_city):
    """Serving coverage requires a city in every actual fitting/evaluation partition."""
    covered = (set(training.city_id) & set(validation.city_id) & set(test.city_id)) - {heldout_city}
    if len(covered) < 3:
        raise ValueError('At least three cities must contribute fitting, validation and test examples after temporal purging')
    return sorted(covered)


def load_dataset(db):
    from sqlalchemy import select
    from app.models import AirQualityObservation, City
    stmt = select(AirQualityObservation, City.latitude, City.longitude).join(City, City.id == AirQualityObservation.city_id).where(AirQualityObservation.timestamp <= datetime.now(UTC)).order_by(AirQualityObservation.city_id, AirQualityObservation.timestamp)
    records = []
    for row, latitude, longitude in db.execute(stmt):
        record = {key: getattr(row, key) for key in ('city_id', 'timestamp', 'pm25', 'pm10', 'no2', 'o3', 'so2', 'co')}
        records.append({**record, 'latitude': latitude, 'longitude': longitude})
    if not records:
        raise ValueError('Database contains no observations. Run python -m app.ml.collect_data first.')
    frame = pd.DataFrame(records)
    frame.timestamp = pd.to_datetime(frame.timestamp, utc=True)
    return frame


def train(frame, artifact_dir, heldout_city='nairobi', origin_stride=23):
    started = time.monotonic()
    if heldout_city not in frame.city_id.unique():
        raise ValueError(f'Heldout city {heldout_city!r} has no collected data')
    known = frame[frame.city_id != heldout_city]
    if known.city_id.nunique() < 3:
        raise ValueError('Collect at least three training cities plus a separate heldout city')
    print(f'Constructing all 72 horizons at rolling origins every {origin_stride} hours', flush=True)
    examples = build_examples(known, origin_stride=origin_stride)
    train_all, validation, test = temporal_split(examples)
    # Cost-controlled direct model samples horizons during fitting; all 72 are evaluated/inferred.
    training = train_all[train_all.horizon_hours.isin(TRAIN_HORIZONS)]
    coverage = supported_cities(training, validation, test, heldout_city)
    excluded_cities = sorted(set(known.city_id) - set(coverage))
    # Keep known-city metrics and model selection restricted to the advertised coverage.
    # Short or shifted city histories are neither silently served nor mixed into these scores.
    training = training[training.city_id.isin(coverage)]
    validation = validation[validation.city_id.isin(coverage)]
    test = test[test.city_id.isin(coverage)]
    schema = feature_columns(training)
    x, y = training[schema], training.target
    vx, vy = validation[schema], validation.target
    print(f'Train={len(training)}, validation={len(validation)}, test={len(test)}; features={len(schema)}', flush=True)
    # A small, explicitly bounded search uses validation only; test is never used for selection.
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction='minimize', sampler=optuna.samplers.TPESampler(seed=SEED))
    def objective(trial):
        alpha = trial.suggest_float('alpha', .1, 1000, log=True)
        candidate = make_pipeline(StandardScaler(), Ridge(alpha=alpha))
        candidate.fit(x, y)
        return metrics(vy, candidate.predict(vx))['mae']
    study.optimize(objective, n_trials=3)
    candidates = {
        'Ridge Regression': make_pipeline(StandardScaler(), Ridge(alpha=study.best_params['alpha'])),
        'Random Forest': RandomForestRegressor(n_estimators=100, max_depth=16, min_samples_leaf=8, n_jobs=4, random_state=SEED),
        'LightGBM': LGBMRegressor(n_estimators=280, learning_rate=.05, num_leaves=31, max_depth=-1, min_child_samples=30, reg_lambda=2., random_state=SEED, n_jobs=4, verbosity=-1, deterministic=True, force_col_wise=True),
        'XGBoost': XGBRegressor(n_estimators=280, learning_rate=.05, max_depth=6, min_child_weight=15, subsample=1., colsample_bytree=1., reg_lambda=3., n_jobs=4, random_state=SEED, tree_method='hist', objective='reg:squarederror'),
    }
    leaderboard = []
    predictions = []
    def record(name, period, part, pred):
        scores = detailed_metrics(part, pred)
        saved = part[['origin', 'target_timestamp', 'city_id', 'horizon_hours', 'target']].copy()
        saved['prediction'], saved['model'], saved['period'] = np.maximum(0, pred), name, period
        predictions.append(saved)
        return scores
    for name, column in [('Persistence baseline', 'persistence'), ('Seasonal naive baseline', 'seasonal_naive')]:
        leaderboard.append({'model_name': name, 'trained': False,
                            'validation': record(name, 'validation', validation, validation[column].to_numpy()),
                            'test': record(name, 'test', test, test[column].to_numpy())})
    for name, estimator in candidates.items():
        print(f'Fitting {name}', flush=True)
        estimator.fit(x, y)
        validation_metrics = record(name, 'validation', validation, estimator.predict(vx))
        leaderboard.append({'model_name': name, 'trained': True, 'validation': validation_metrics})
        print(f'{name}: validation MAE={validation_metrics["mae"]:.4f}', flush=True)
    best_row = min((row for row in leaderboard if row['trained']), key=lambda row: row['validation']['mae'])
    winner_name = best_row['model_name']
    winner = candidates[winner_name]
    # All comparisons are displayed, but no model or hyperparameter is chosen from these test scores.
    for row in leaderboard:
        if row['trained']:
            row['test'] = record(row['model_name'], 'test', test, candidates[row['model_name']].predict(test[schema]))
    heldout_examples = build_examples(frame[frame.city_id == heldout_city], origin_stride=origin_stride)
    heldout = heldout_examples[heldout_examples.origin >= test.origin.min()]
    if heldout.empty:
        raise ValueError('No heldout city examples overlap known-city test period')
    heldout_metrics = record(winner_name, 'heldout_city', heldout, winner.predict(heldout[schema]))
    for name, column in [('Persistence baseline', 'persistence'), ('Seasonal naive baseline', 'seasonal_naive')]:
        record(name, 'heldout_city', heldout, heldout[column].to_numpy())
    importance_frame = validation.iloc[np.linspace(0, len(validation)-1, min(1200, len(validation)), dtype=int)]
    print('Computing validation permutation importance', flush=True)
    importance = permutation_importance(winner, importance_frame[schema], importance_frame.target,
                                       scoring='neg_mean_absolute_error', n_repeats=3, random_state=SEED, n_jobs=1)
    features = sorted([{'feature': name, 'importance': float(value), 'std': float(std)}
                       for name, value, std in zip(schema, importance.importances_mean, importance.importances_std)],
                      key=lambda row: row['importance'], reverse=True)
    digest = hashlib.sha256(pd.util.hash_pandas_object(frame, index=False).to_numpy().tobytes()).hexdigest()
    now = datetime.now(UTC)
    version = f'cams-direct-{now.strftime("%Y%m%dT%H%M%SZ")}-{digest[:8]}'
    metadata = {
        'version': version, 'model_name': winner_name, 'training_date': now.isoformat(),
        'dataset_version': digest, 'seed': SEED, 'feature_schema': schema,
        'supported_city_ids': coverage, 'excluded_incomplete_city_ids': excluded_cities,
        'heldout_city_id': heldout_city, 'heldout_city': heldout_metrics,
        'leaderboard': sorted(leaderboard, key=lambda row: row['validation']['mae']),
        'metrics': best_row['test'], 'feature_importance': {'features': features,
            'method': 'Validation permutation importance (MAE increase, 3 permutations)',
            'description': 'Global predictive associations on a chronological validation sample. Correlated features share importance; this is not causal or a local explanation.'},
        'selection': 'Lowest known-city validation MAE among trained classical estimators; baselines reported separately; no refit after test evaluation.',
        'baseline_beats_winner': any(row['validation']['mae'] < best_row['validation']['mae'] for row in leaderboard if not row['trained']),
        'strategy': 'Pooled direct multi-horizon; lag pollution at or before origin + deterministic target calendar/geography; no weather features.',
        'uncertainty': None,
        'warnings': ([f'Cities omitted from fitting, known-city evaluation and forecast coverage because not present in every partition: {", ".join(excluded_cities)}.'] if excluded_cities else []) + ['Retrospective CAMS estimate prediction; not station-observation accuracy.',
                     'Archive issue-time availability and revision history are not established; metrics are not an operational as-of backtest.',
                     'No calibrated prediction intervals; worldwide city search does not imply forecast coverage.'],
        'validation_strategy': 'Chronological rolling origins, full 72h purge across period boundaries; unseen city excluded from all fitting and selection.',
        'training_configuration': {'origin_stride_hours': origin_stride, 'training_horizons': list(TRAIN_HORIZONS),
            'evaluation_horizons': list(range(1, 73)), 'ridge_optuna_trials': 3, 'ridge_best_alpha': study.best_params['alpha'],
            'training_rows': len(training), 'validation_rows': len(validation), 'test_rows': len(test),
            'train_origin_start': str(training.origin.min()), 'train_origin_end': str(training.origin.max()),
            'train_target_end': str(training.target_timestamp.max()), 'validation_origin_start': str(validation.origin.min()),
            'validation_target_end': str(validation.target_timestamp.max()), 'test_origin_start': str(test.origin.min()),
            'test_target_end': str(test.target_timestamp.max()), 'fitted_estimator_params': winner.get_params(deep=False)},
        'dataset': {'records': len(frame), 'start': str(frame.timestamp.min()), 'end': str(frame.timestamp.max()),
                    'cities': frame.groupby('city_id').size().to_dict(), 'missing_pm25': int(frame.pm25.isna().sum()),
                    'source': 'Open-Meteo / Copernicus CAMS model-derived atmospheric estimates'},
        'dependencies': {package: importlib.metadata.version(package) for package in ('numpy', 'pandas', 'scikit-learn', 'lightgbm', 'xgboost', 'optuna', 'joblib')},
        'training_seconds': round(time.monotonic()-started, 2),
    }
    # Ridge pipeline params contain estimator objects; store their readable names only.
    metadata['training_configuration']['fitted_estimator_params'] = {k: v if isinstance(v, (str, int, float, bool, type(None))) else str(v) for k, v in metadata['training_configuration']['fitted_estimator_params'].items()}
    folder = Path(artifact_dir) / version
    folder.mkdir(parents=True, exist_ok=True)
    artifact = {'estimator': winner, 'feature_schema': schema, 'metadata': metadata}
    joblib.dump(artifact, folder / 'model.joblib', compress=3)
    (folder / 'metadata.json').write_text(json.dumps(metadata, indent=2, allow_nan=False), encoding='utf-8')
    pd.concat(predictions, ignore_index=True).to_csv(folder / 'evaluation_predictions.csv', index=False)
    pointer = Path(artifact_dir) / 'current.json'
    temporary = pointer.with_suffix('.tmp')
    temporary.write_text(json.dumps({'version': version, 'directory': version}), encoding='utf-8')
    temporary.replace(pointer)
    print(f'Saved {winner_name}, test MAE={best_row["test"]["mae"]:.4f}, heldout MAE={heldout_metrics["mae"]:.4f}', flush=True)
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact-dir')
    parser.add_argument('--heldout-city', default='nairobi')
    parser.add_argument('--origin-stride', type=int, default=23, help='23h defaults cycle origins through every hour of day')
    args = parser.parse_args()
    if not 1 <= args.origin_stride <= 48:
        parser.error('--origin-stride must be 1..48 hours')
    from sqlalchemy import update
    from app.core.config import get_settings
    from app.db.session import SessionLocal
    from app.models import ModelRegistry
    folder = Path(args.artifact_dir or get_settings().model_artifact_dir).resolve()
    with SessionLocal() as db:
        frame = load_dataset(db)
        metadata = train(frame, folder, args.heldout_city, args.origin_stride)
        db.execute(update(ModelRegistry).values(active=False))
        db.add(ModelRegistry(version=metadata['version'], model_name=metadata['model_name'],
                 training_date=datetime.fromisoformat(metadata['training_date']), feature_schema=metadata['feature_schema'],
                 evaluation_metrics=metadata['metrics'], artifact_path=str(folder / metadata['version'] / 'model.joblib'), metadata_json=metadata, active=True))
        db.commit()
    print(json.dumps({'version': metadata['version'], 'winner': metadata['model_name'], 'test_mae': metadata['metrics']['mae']}, indent=2))


if __name__ == '__main__':
    main()
