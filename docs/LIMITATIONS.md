# Known limits

- Environmental values are CAMS/weather model estimates, not station observations. Grid resolution and provider interpolation limit local precision.
- Backtesting is retrospective on downloaded archives. Original issue-time availability and revisions are unverified; do not claim fully operational historical as-of performance.
- The initial model is evaluated across eight selected cities and serves only seven training-city IDs. Worldwide geocoding/current/history access does not imply worldwide model accuracy. Nairobi remains excluded from forecast coverage as an untouched city holdout.
- Weather is ingested and displayed but intentionally excluded from the first forecasting estimator. No future realized-weather feature is used.
- Intervals are omitted until independently calibrated and coverage-tested. No AQI, additional pollutant forecasts, medical recommendations or causality claims are provided.
- The direct estimator fits ten selected horizons and evaluates all 72. Intermediate hours use the pooled model's horizon feature. It is not 72 independent fitted estimators.
- Rolling origins share target windows. Metrics are correlated retrospective samples; no confidence interval on those aggregate metrics is claimed.
- Rate limits, source cache and scheduler ownership are per process. Use one API worker initially; a public multi-instance deployment needs shared limiting and single scheduler ownership. Authentication is not included for the public dashboard; keep training operator-only via CLI.
- Source values update on provider schedules (global CAMS roughly every 12 hours, European forecasts roughly daily). Hourly output is not a claim of hourly model regeneration. Provider failures and missing records are shown explicitly.
- The public free Open-Meteo API is for non-commercial evaluation. Commercial hosting requires the appropriate provider plan/configuration and review of licensing/attribution terms.
- Map tiles require access to their external provider. Geographic markers represent queried locations only. There is no continuous inferred global pollution heatmap.
- Artifacts and datasets are intentionally ignored by Git. They persist locally/on mounted storage and can be rebuilt with documented commands. Back up both database and versioned artifact directory together.
- Training reproducibility depends on the saved source data and dependency versions. Future archive downloads can change if the upstream revises estimates.
- The automated backend tests currently report an upstream Starlette/httpx TestClient deprecation. Passing tests do not eliminate future dependency-upgrade work. ML timestamp arithmetic was updated and its tests pass with deprecation warnings treated as errors.
- The production frontend dependency audit is clean at verification. Five high-severity advisories remain in the development-only ESLint dependency chain; they are recorded rather than represented as an all-dependency clean audit.

Executed verification, any remaining UI gaps and deployment evidence are recorded in `IMPLEMENTATION_STATUS.md`.
