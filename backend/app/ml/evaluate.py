"""Metric helpers and CLI for persisted, reproducible retrospective evaluations."""
import argparse
import json
from pathlib import Path
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def metrics(actual, prediction):
    actual, prediction = np.asarray(actual), np.maximum(0, np.asarray(prediction))
    return {'mae': float(mean_absolute_error(actual, prediction)),
            'rmse': float(np.sqrt(mean_squared_error(actual, prediction))),
            'r2': float(r2_score(actual, prediction)) if len(actual) > 1 and np.std(actual) > 0 else None,
            'bias': float(np.mean(prediction-actual)), 'samples': len(actual)}


def detailed_metrics(frame, prediction):
    frame = frame.copy()
    frame['prediction'] = np.maximum(0, prediction)
    result = metrics(frame.target, frame.prediction)
    result['by_horizon'] = {str(int(h)): metrics(part.target, part.prediction) for h, part in frame.groupby('horizon_hours')}
    result['by_city'] = {str(city): metrics(part.target, part.prediction) for city, part in frame.groupby('city_id')}
    # These are concentration bands, not an AQI or medical risk classification.
    frame['band'] = np.select([frame.target < 10, frame.target < 35, frame.target < 75], ['below_10', '10_to_35', '35_to_75'], default='75_and_above')
    result['by_concentration_band'] = {str(band): metrics(part.target, part.prediction) for band, part in frame.groupby('band')}
    residuals = frame.prediction - frame.target
    counts, edges = np.histogram(residuals, bins=20)
    result['residual_distribution'] = {'counts': counts.tolist(), 'bin_edges': edges.tolist()}
    sample = frame.iloc[np.linspace(0, len(frame)-1, min(120, len(frame)), dtype=int)]
    result['actual_vs_predicted'] = [{'actual': float(row.target), 'predicted': float(row.prediction), 'horizon_hours': int(row.horizon_hours), 'city_id': row.city_id} for row in sample.itertuples()]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact-dir')
    parser.add_argument('--recompute', action='store_true', help='Recompute test/heldout metrics from saved predictions, without retraining or model selection')
    args = parser.parse_args()
    from app.core.config import get_settings
    folder = Path(args.artifact_dir or get_settings().model_artifact_dir)
    if not (folder / 'metadata.json').exists() and (folder / 'current.json').exists():
        pointer = json.loads((folder / 'current.json').read_text(encoding='utf-8'))
        folder = folder / pointer['directory']
    if args.recompute:
        import pandas as pd
        frame = pd.read_csv(folder / 'evaluation_predictions.csv')
        report = {f'{model}/{period}': detailed_metrics(part, part.prediction.to_numpy())
                  for (model, period), part in frame.groupby(['model', 'period'])}
    else:
        report = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
    print(json.dumps(report, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
