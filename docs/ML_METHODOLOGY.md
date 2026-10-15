# Forecast methodology

## Objective and target provenance

Predict 72 hourly PM2.5 concentrations using an estimator trained by this repository. Inputs and targets are Open-Meteo / CAMS model-derived atmospheric estimates, not station measurements. Performance therefore measures prediction of CAMS estimates, not clinical exposure, street-level pollution or sensor accuracy.

The executed dataset contains 70,032 hourly air-quality records and the same number of weather records over October 16, 2025 through October 15, 2026 (partial current day). Eight cities cover several regions and concentration profiles: Cairo, London, Delhi, New York, Tokyo, São Paulo, Sydney and Nairobi. PM2.5 missingness was zero in this run. The city collection is configurable; it is not a comprehensive global evaluation.

## Direct multi-horizon design

At each origin, a pooled estimator receives the requested horizon, geographic coordinates, deterministic target calendar encodings, PM2.5 lags 0/1/3/6/12/24/48/72 hours, trailing statistics over 6/24/72 hours, a six-hour slope and current co-pollutants with explicit missing flags. Every pollution feature reads values at or before the origin. Lag 0 is the latest estimate already retrieved for the origin. Trailing windows end at the origin; they do not use target data. Exactly 73 consecutive nonmissing PM2.5 hours are required. Target labels are held separately and excluded from the feature schema.

Historical and forecast weather are not interchangeable. The initial estimator uses **no weather covariates**, avoiding future realized-weather leakage entirely. Weather ingestion and display remain useful independently. Adding future weather requires archived issue-time forecast data and a separate valid evaluation.

Origins advance by 23 hours, cycling through hours of day. To bound fitting cost, training uses horizons 1, 3, 6, 12, 18, 24, 36, 48, 60 and 72. The horizon is a numeric feature; intermediate horizons are model interpolation, not separately fitted estimators. Validation, test, held-out-city evaluation and inference use all 72 horizons. This compromise is explicit in the saved training configuration.

## Evaluation and selection

Nairobi is removed from all training and selection. Known-city origins are split chronologically approximately 65% training, 17% validation and 18% test. A full 72-hour embargo removes training origins whose longest targets could overlap validation, and validation origins whose targets could overlap test. There is no time-series shuffling. Rolling-origin evaluation uses many origin/target pairs within each fixed period; it is not an expanding-window refit at every origin. Overlapping target windows mean metric samples are correlated; sample counts are not independent trials.

Compare persistence, daily seasonal naive, standardized Ridge, Random Forest, LightGBM and XGBoost. Seeds are fixed at 42. A bounded three-trial Optuna search selects Ridge alpha using validation only. The winning trained estimator is selected by lowest known-city validation MAE, with baseline comparisons retained. Test results do not choose the winner. No refitting after the held-out test is performed in this initial artifact.

Metrics: MAE, RMSE, R² where meaningful, bias, all hourly horizons, city and concentration bands. Concentration bands are analytical bins, not AQI or health categories. Residual histograms and actual-vs-predicted samples are saved. MAPE is not used. Raw prediction/target pairs are preserved to reproduce metrics without retraining.

Actual run results and split boundaries are committed in `ML_EVALUATION.json`. LightGBM won validation MAE 10.6625 µg/m³. Known-city test MAE was 8.5785 and RMSE 14.3597; held-out Nairobi MAE was 4.0520 and RMSE 5.0094. Nairobi's lower concentration distribution means its raw MAE is not evidence of superior global generalization. XGBoost had a slightly lower test MAE (8.4992) but was correctly not selected from the test set.

## Archive availability limitation

The present-day archive contains estimates indexed by valid time. Original issuance times, publication delays and revision history are not established by these responses. Strictly lagged features and purged labels prevent numerical future-target leakage; they cannot reconstruct information that was actually published at a historical origin. These results are an honest retrospective archive evaluation, **not proof of an operational as-of historical backtest**. Establishing that stronger claim requires vintage/issue-time archives or a prospective evaluation using snapshots saved when retrieved.

## Artifact and inference contracts

Each training run saves an immutable version directory containing `model.joblib`, `metadata.json` and `evaluation_predictions.csv`. `current.json` points to the latest run. PostgreSQL registers the exact artifact path, feature schema, training timestamp, dataset hash and metadata. The artifact's version must match the registry. Package versions, parameters and random seed are recorded. Only trusted operator-created local artifacts are loaded; arbitrary uploaded pickle/joblib files are not accepted.

Operational inference validates saved features, requires a current UTC-hour estimate, and emits horizons 1–72 with finite, nonnegative predictions. If current data is unavailable, the app refuses an obsolete future window with an actionable message. A successful run and all 72 values are persisted. Coverage initially includes only the seven known training cities; Nairobi and newly searched locations retain source data access but no unsupported forecast claim.

## Explanations and intervals

The model lab displays real permutation importance measured as validation MAE increase over three repeats on a bounded validation sample. This is global predictive association; correlated features can share importance. It is neither causal evidence nor a local explanation of an individual pollution event. SHAP is an installed option, not a claimed implemented chart.

No calibrated prediction intervals are produced. Bounds and uncertainty are null with an explicit explanation. Separate residual calibration followed by untouched coverage evaluation is required before intervals can be represented as reliable.

No derived AQI is implemented. Hourly PM2.5 is not a complete official multipollutant AQI, and the app does not label it as one.
