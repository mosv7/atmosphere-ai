# MASTER BUILD PROMPT — ATMOSPHERE AI

## Your Role

You are a principal machine learning engineer, senior full-stack architect, data engineer, MLOps engineer, and award-winning product designer.

Your task is to autonomously design, implement, test, and deliver a complete, production-minded application called:

# ATMOSPHERE AI
### Global Air Quality Intelligence & Forecasting Platform

Build a sophisticated, beautiful, functional, end-to-end machine learning product that monitors global air quality and predicts pollution levels for the next 72 hours.

This is NOT a prototype, notebook demonstration, generic Streamlit dashboard, or static UI mockup.

It must be a working full-stack application with real API integrations, reproducible ML training, real inference, persistent storage, an outstanding Next.js interface, and deployment configuration.

You are responsible for the entire implementation.

Do not stop after planning, scaffolding, or implementing a subset of features.

Continue systematically until the application is operational, tested, and documented.

Do not ask for routine architectural or design decisions. Make reasonable engineering decisions independently.

Only request user intervention for genuinely unavoidable external dependencies, such as unavailable credentials.

---

# 1. PRODUCT VISION

Atmosphere AI is a global environmental intelligence platform.

Users should be able to:

1. Search for cities worldwide.
2. Explore current air quality conditions.
3. Inspect pollutant concentrations.
4. View historical pollution trends.
5. Generate 72-hour pollution forecasts using our own trained ML models.
6. Understand the factors influencing predictions.
7. Compare environmental conditions across cities.
8. Explore pollution patterns geographically.
9. Inspect the ML models powering the system.
10. Understand forecast uncertainty and data freshness.

The application should feel like a premium environmental intelligence product used by researchers, analysts, and environmental organizations.

Think of the visual sophistication of modern financial analytics terminals combined with an elegant geospatial monitoring platform.

The final product should feel cohesive, polished, responsive, and genuinely useful.

---

# 2. NON-NEGOTIABLE REQUIREMENTS

## 2.1 Real data only

Use real historical and current environmental data from documented APIs.

Do not fabricate environmental observations.

Do not silently replace missing API responses with synthetic data.

Do not generate random values to populate dashboard cards or charts.

Do not present mock data as live data.

A clearly labeled demo mode is acceptable only as an optional development feature, never as the default experience.

## 2.2 Classical machine learning only

Allowed:

- LightGBM
- XGBoost
- Random Forest
- HistGradientBoosting
- Gradient Boosting
- Ridge Regression
- Elastic Net
- Classical statistical baselines
- Classical anomaly detection algorithms

Not allowed:

- LSTM
- GRU
- Transformers
- Neural networks
- Foundation models
- LLM-based prediction
- Deep learning forecasting

The prediction engine must be built using classical ML.

## 2.3 Genuine ML inference

The application must train and use its own models.

Never present a third-party API's air-quality forecast as our own ML prediction.

Third-party forecasts may be used as explicitly identified exogenous features or displayed as clearly labeled external reference forecasts.

Maintain provenance for all observations and predictions.

## 2.4 No look-ahead leakage

This is a time-series forecasting application.

Training, validation, backtesting, and inference must respect what information was actually available at each prediction timestamp.

Never use future observed pollutant values to predict the past.

Never use future realized weather measurements as though they were historical weather forecasts.

Never randomly shuffle time-series observations across training and validation sets.

## 2.5 No fake completeness

If a data source does not support a requested feature or location:

- Detect the limitation.
- Handle it gracefully.
- Explain it in the UI.
- Preserve application stability.
- Document the limitation.

Never silently invent data or model capabilities.

---

# 3. TECHNOLOGY STACK

## Frontend

Use:

- Next.js with App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Apache ECharts
- MapLibre GL JS
- Framer Motion / Motion where appropriate
- TanStack Query
- Zustand only if useful
- Zod for validation

Use a clean, scalable frontend architecture.

## Backend

Use:

- Python 3.12+
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- HTTPX
- APScheduler or another appropriate lightweight scheduler
- Structured logging

## Machine Learning

Use:

- pandas
- NumPy
- scikit-learn
- LightGBM
- XGBoost
- Optuna for controlled hyperparameter tuning
- SHAP where compatible
- joblib or an appropriate model artifact format

## Infrastructure

Use:

- Docker
- Docker Compose
- Environment-based configuration
- Health checks
- Persistent database volumes
- Reproducible setup scripts

Avoid adding unnecessary infrastructure such as Kafka, Kubernetes, or Redis unless a real requirement justifies it.

---

# 4. DATA SOURCES

Prioritize documented, accessible, reputable APIs.

## 4.1 Open-Meteo Air Quality API

Primary candidate for air-quality data.

Documentation:

https://open-meteo.com/en/docs/air-quality-api

Investigate:

- Historical air-quality availability
- Current air-quality estimates
- PM2.5
- PM10
- Nitrogen dioxide
- Ozone
- Sulfur dioxide
- Carbon monoxide
- Available AQI variables
- Temporal resolution
- Geographic coverage
- Data update frequency
- Usage limits
- Attribution and licensing

IMPORTANT:

Verify the actual historical capabilities of the API.

Do not assume the forecast endpoint provides unlimited historical observations.

Determine whether a separate historical air-quality endpoint or another documented source is needed.

Distinguish model-derived air-quality estimates from direct station measurements.

## 4.2 Open-Meteo Historical Weather API

Documentation:

https://open-meteo.com/en/docs/historical-weather-api

Candidate historical weather variables:

- Temperature
- Relative humidity
- Wind speed
- Wind direction
- Surface pressure
- Precipitation
- Cloud cover
- Boundary-layer-related variables if actually available

Check variable availability before implementation.

## 4.3 Open-Meteo Weather Forecast API

Documentation:

https://open-meteo.com/en/docs

Use for future weather covariates when supported.

Clearly distinguish:

- Historical realized weather
- Current weather estimates
- Future weather forecasts

## 4.4 Open-Meteo Geocoding API

Documentation:

https://open-meteo.com/en/docs/geocoding-api

Use to implement worldwide city search.

Support:

- City name
- Country
- Administrative region
- Latitude
- Longitude
- Timezone

Handle duplicate city names correctly.

## 4.5 Optional sources

Investigate only if necessary:

- OpenAQ
- Other reputable environmental data providers

Do not introduce paid dependencies unless unavoidable.

Prefer a fully functional application without mandatory API keys.

If an API key is required for an optional provider, keep that integration optional.

## 4.6 Data-source validation

Before implementing the ML pipeline:

1. Inspect actual API responses.
2. Verify timestamp semantics.
3. Verify variable units.
4. Verify available history.
5. Check missingness.
6. Check geographic coverage.
7. Confirm API limits.
8. Document data provenance.

Build adapters around verified schemas rather than assumptions.

---

# 5. FORECASTING OBJECTIVE

## Primary prediction target

Forecast hourly PM2.5 concentration for the next 72 hours.

The forecast must produce:

- 72 hourly point predictions
- A timestamp for each prediction
- Appropriate uncertainty estimates when calibrated
- Model metadata
- Data freshness information

## Secondary targets

If the data quality supports them, implement:

- PM10 forecasting
- Derived AQI forecasting
- Pollution severity classification

IMPORTANT:

AQI is not a universal raw measurement.

Different regions use different AQI definitions.

Implement a documented AQI calculation standard, such as US EPA AQI, using the required pollutant concentrations and averaging conventions.

Do not label a PM2.5-only approximation as a complete official multi-pollutant AQI.

If only a PM2.5-based sub-index can be calculated, explicitly label it as such.

Do not implement secondary targets at the expense of a reliable PM2.5 forecasting system.

---

# 6. FORECASTING ARCHITECTURE

Build a robust forecasting pipeline that supports 72-hour inference without leaking future information.

Preferred approach:

A direct multi-horizon forecasting strategy using LightGBM or XGBoost.

For each prediction timestamp, construct features that would have been available at that time.

Candidate features:

### Historical pollutant features

- PM2.5 lag 1 hour
- PM2.5 lag 3 hours
- PM2.5 lag 6 hours
- PM2.5 lag 12 hours
- PM2.5 lag 24 hours
- PM2.5 lag 48 hours
- PM2.5 lag 72 hours

### Rolling statistics

- Rolling mean
- Rolling standard deviation
- Rolling minimum
- Rolling maximum
- Short-term trend

Ensure all rolling features are shifted correctly to avoid leakage.

### Temporal features

- Hour of day
- Day of week
- Month
- Weekend indicator
- Cyclical hour encoding
- Cyclical day-of-year encoding

### Weather features

- Temperature
- Humidity
- Wind speed
- Wind direction
- Pressure
- Precipitation

### Geographic features

- Latitude
- Longitude
- Elevation when available

### Forecast horizon

- Prediction horizon in hours
- Target hour-of-day
- Target day-of-week

Train a model that predicts PM2.5 at a specified horizon using features available at forecast issuance.

A pooled direct multi-horizon model is acceptable if properly evaluated.

Separate horizon models or horizon groups are acceptable if justified by validation results.

Do not choose a recursive strategy merely because it is easier.

Evaluate its error accumulation if used.

---

# 7. HISTORICAL WEATHER FORECAST LEAKAGE

This is a critical engineering requirement.

Future weather observations are not equivalent to weather forecasts that were available in the past.

When backtesting 72-hour pollution forecasts, do not use future realized weather as if it were known at the forecast origin.

Implement one of these defensible strategies:

A. Obtain historical archived weather forecasts corresponding to historical forecast issuance times.

B. Use only features available at the forecast origin, including past weather and pollutant observations.

C. Build and clearly evaluate a weather-forecast-free baseline, then add future weather forecasts only when a methodologically valid historical evaluation is possible.

Document the chosen approach.

Do not silently create overly optimistic validation results.

---

# 8. DATA COLLECTION PIPELINE

Implement a reusable historical ingestion system.

Required capabilities:

- Select a city or geographic location.
- Resolve its coordinates.
- Fetch available historical air-quality data.
- Fetch corresponding historical weather data.
- Normalize timestamps.
- Convert units consistently.
- Merge sources safely.
- Preserve source metadata.
- Detect missing values.
- Detect duplicates.
- Identify temporal gaps.
- Store normalized records in PostgreSQL.
- Cache repeated requests.
- Retry transient API failures.
- Respect rate limits.

Implement configurable historical training windows.

Aim for substantial historical coverage when available, but do not assume that all cities have identical historical coverage.

Support incremental updates.

Create commands such as:

python -m app.ml.collect_data
python -m app.ml.train
python -m app.ml.evaluate

Adapt paths to the actual project structure.

---

# 9. MACHINE LEARNING TRAINING

Implement a real training pipeline.

## Baselines

Start with:

1. Persistence baseline
2. Seasonal naive baseline
3. Ridge Regression

## Candidate ML models

Compare:

1. Random Forest
2. LightGBM
3. XGBoost

Use time-based validation.

Use rolling-origin backtesting where practical.

Evaluate multiple forecast horizons:

- 1 hour
- 6 hours
- 12 hours
- 24 hours
- 48 hours
- 72 hours

Metrics:

- MAE
- RMSE
- R² when informative
- Bias
- Error by horizon
- Error by city
- Error by pollution severity

Avoid relying on MAPE when values approach zero.

Save:

- Best model
- Feature schema
- Preprocessing configuration
- Training metadata
- Validation results
- Training date
- Dataset version
- Model version

Make training reproducible.

Use deterministic seeds where possible.

Avoid expensive tuning that provides negligible value.

---

# 10. MODEL GENERALIZATION

The application must support worldwide city search.

However, worldwide search does not automatically imply worldwide forecast accuracy.

Implement an explicit generalization strategy.

Preferred initial strategy:

Train a global or regional model using historical data from a geographically diverse, configurable collection of cities.

Include multiple climate regions and pollution profiles.

Evaluate on:

- Future periods from known cities
- Held-out cities not seen during training

Report these evaluations separately.

Do not claim that a model trained on three Egyptian cities generalizes reliably to every city worldwide.

For cities outside supported model coverage:

- Show the current observations if available.
- Provide a forecast only if the model is designed to support that location.
- Display model coverage and uncertainty.
- Clearly communicate limitations.

Optionally support location-specific fine-tuning when enough historical data exists.

Do not block the entire application because one location lacks enough training history.

---

# 11. LIVE INFERENCE ENGINE

Implement an operational inference pipeline.

When a user selects a city:

1. Resolve its coordinates.
2. Fetch the latest available air-quality observations.
3. Fetch required recent historical observations.
4. Fetch current weather conditions.
5. Fetch future weather forecasts only if the trained model supports those features.
6. Validate incoming data against the saved feature schema.
7. Generate the next 72 hourly PM2.5 predictions.
8. Derive secondary outputs only where valid.
9. Save the prediction run.
10. Return structured results to the frontend.

Each prediction response must include:

- City
- Coordinates
- Forecast issuance timestamp
- Observation timestamp
- Forecast timestamps
- Predicted values
- Units
- Model version
- Data source
- Data freshness
- Coverage information
- Warnings
- Uncertainty information, if available

Cache forecasts appropriately.

Implement scheduled refreshes based on actual source update frequencies.

Do not claim second-by-second real-time updates if the upstream source updates hourly.

Use accurate language such as "Latest available data" or "Updated hourly" when appropriate.

---

# 12. BACKEND API

Design a clean REST API.

Suggested endpoints:

GET /api/health

GET /api/cities/search

GET /api/air-quality/current

GET /api/air-quality/history

GET /api/forecast/72h

GET /api/forecast/latest

GET /api/analytics/pollutants

GET /api/analytics/trends

GET /api/analytics/city-comparison

GET /api/models

GET /api/models/metrics

GET /api/models/feature-importance

GET /api/data/coverage

POST /api/forecast/generate

GET /api/system/status

Design request and response schemas carefully.

Provide:

- OpenAPI documentation
- Input validation
- Meaningful error responses
- Request timeouts
- Retry handling
- Caching
- Pagination where needed
- Rate limiting where appropriate
- Structured logs

Avoid unnecessary authentication for the initial public dashboard unless a protected administrative feature requires it.

---

# 13. DATABASE DESIGN

Use PostgreSQL.

Suggested entities:

### cities
- id
- name
- country
- administrative_region
- latitude
- longitude
- timezone

### air_quality_observations
- id
- city_id
- timestamp
- pm25
- pm10
- no2
- o3
- so2
- co
- source
- source_type
- retrieved_at

### weather_observations
- id
- city_id
- timestamp
- temperature
- humidity
- wind_speed
- wind_direction
- precipitation
- pressure
- source

### forecast_runs
- id
- city_id
- model_version
- issued_at
- source_data_timestamp
- status

### forecast_values
- id
- forecast_run_id
- target_timestamp
- horizon_hours
- predicted_pm25
- lower_bound
- upper_bound

### model_registry
- id
- model_name
- version
- training_date
- feature_schema
- evaluation_metrics
- artifact_path

### ingestion_jobs
- id
- source
- started_at
- completed_at
- status
- records_processed
- error_message

Add appropriate constraints, indexes, and migrations.

Use UTC internally and render local times appropriately in the UI.

---

# 14. FRONTEND DESIGN — EXTREMELY IMPORTANT

The frontend is a major part of this project.

Do not create a generic admin template.

Do not build a dashboard made of repetitive cards and basic charts.

Create a distinctive, premium, carefully art-directed product.

## Design identity

Product name:

ATMOSPHERE AI

Brand personality:

- Scientific
- Elegant
- Precise
- Calm
- Futuristic
- Trustworthy
- Premium

## Visual direction

Create a sophisticated environmental intelligence interface.

Use:

- Deep navy backgrounds
- Rich charcoal surfaces
- Emerald accents
- Cyan highlights
- Carefully controlled gradients
- Elegant typography
- Subtle atmospheric visual effects
- Large, expressive data visualizations
- Strong information hierarchy
- Generous spacing
- Beautiful interaction states

Avoid:

- Excessive glassmorphism
- Neon overload
- Generic SaaS layouts
- Unnecessary decorative charts
- Low-contrast text
- Overwhelming animation
- Repetitive metric cards
- Fake visualizations

The interface must feel designed, not assembled.

## Themes

Implement fully polished:

- Dark mode
- Light mode

Both themes must be designed intentionally.

Do not simply invert colors.

## Responsive behavior

Support:

- Desktop
- Laptop
- Tablet
- Mobile

The mobile experience should have a deliberate layout rather than a compressed desktop dashboard.

---

# 15. REQUIRED APPLICATION SCREENS

Build every screen below.

Each screen must have meaningful functionality and actual backend integration.

## SCREEN 1 — GLOBAL OVERVIEW

This is the main command center.

Create a dramatic but usable layout.

### Main elements

A large interactive global map showing selected locations and their latest available air-quality conditions.

An elegant top navigation area.

A city search interface.

A current air-quality summary for the selected city.

Pollutant concentration indicators.

A 72-hour forecast preview.

A compact pollution trend chart.

A data freshness indicator.

A clear distinction between observed values and model predictions.

### Interaction

Clicking a city or map marker should update the dashboard.

The map should support:

- Zoom
- Pan
- City markers
- Pollutant-based coloring
- Informative tooltips
- Location selection

Do not fabricate global heatmap coverage from sparse city observations.

If displaying a continuous heatmap, use a legitimate gridded data source or clearly documented interpolation method.

---

## SCREEN 2 — CITY INTELLIGENCE

A detailed environmental profile for a selected city.

Include:

- Current air-quality conditions
- Pollutant breakdown
- Historical trends
- Weather conditions
- Daily and hourly patterns
- Recent anomalies
- Data availability
- Source information

Create sophisticated, interactive charts.

Allow users to switch between pollutants.

Provide useful time ranges:

- 24 hours
- 7 days
- 30 days
- 90 days
- Custom range when feasible

All charts must use real observations.

---

## SCREEN 3 — FORECAST STUDIO

This is the primary ML-powered screen.

Create a beautiful forecasting interface.

Include:

### Main forecast chart

Display:

- Historical PM2.5 observations
- Forecast boundary
- Next 72 hourly predictions
- Uncertainty intervals where calibrated

Make the transition between observed and predicted data visually unmistakable.

### Forecast controls

- City selector
- Forecast horizon selector
- Pollutant selector when supported
- Refresh forecast button

### Forecast summary

- Expected peak pollution
- Time of expected peak
- Average predicted concentration
- Expected pollution trend
- Forecast generation time

### Forecast table

Allow users to inspect individual hourly predictions.

### Model information

Display:

- Model version
- Model family
- Validation metrics
- Data freshness
- Coverage limitations

---

## SCREEN 4 — GLOBAL EXPLORER

Create a map-first environmental exploration experience.

Include:

- Full-screen interactive map
- Search
- Location selection
- Pollutant filters
- Time controls
- City detail drawer
- Legend
- Source attribution

Make the map fast, intuitive, and visually impressive.

Only display geographical data supported by the actual source.

---

## SCREEN 5 — CITY COMPARISON

Allow users to compare multiple cities.

Features:

- Select 2–5 cities
- Compare PM2.5
- Compare PM10 when available
- Compare current conditions
- Compare historical trends
- Compare 72-hour forecasts
- Compare data freshness

Use synchronized charts and clear legends.

Handle missing values gracefully.

---

## SCREEN 6 — MODEL INTELLIGENCE LAB

This screen should demonstrate genuine ML engineering.

Include:

### Model leaderboard

Compare:

- Persistence baseline
- Seasonal naive baseline
- Ridge Regression
- Random Forest
- LightGBM
- XGBoost

Show only models actually trained and evaluated.

### Evaluation metrics

- MAE
- RMSE
- Error by horizon
- Error by city

### Feature importance

Use SHAP where supported and computationally practical.

Explain whether the visualization represents global feature importance or a local prediction explanation.

### Model information

- Model version
- Training timestamp
- Dataset coverage
- Training configuration
- Validation strategy

### Error analysis

Visualize:

- Residual distributions
- Prediction error by horizon
- Actual vs predicted
- City-level performance

Never invent evaluation results.

---

## SCREEN 7 — DATA EXPLORER

Build an interface for inspecting actual collected datasets.

Include:

- Data-source overview
- Historical coverage
- Available pollutants
- Available weather variables
- Missing-data statistics
- Latest ingestion timestamp
- Sample records
- Data-quality indicators

Allow filtering by city and date range.

This screen is especially important for demonstrating that the application is grounded in real data.

---

## SCREEN 8 — SYSTEM STATUS

Build a small but polished operational status screen.

Display:

- Backend health
- Database connectivity
- Data-source availability
- Last successful ingestion
- Last forecast generation
- Active model version
- Scheduler status

Do not fake operational health indicators.

---

# 16. UX REQUIREMENTS

Implement:

- Elegant skeleton loading states
- Smooth page transitions
- Useful empty states
- Error boundaries
- Retry actions
- Keyboard-accessible navigation
- Responsive chart layouts
- Accessible contrast
- Clear units
- Human-readable timestamps
- Helpful tooltips
- Search suggestions
- Thoughtful microinteractions

Use motion sparingly.

Prioritize performance and clarity over decorative animation.

The dashboard must remain usable even if external APIs are temporarily unavailable.

---

# 17. COMPONENT ARCHITECTURE

Build reusable frontend components.

Suggested components:

- AppShell
- SidebarNavigation
- GlobalSearch
- CitySelector
- AirQualityGauge
- PollutantCard
- ForecastChart
- HistoricalTrendChart
- GlobalAirQualityMap
- CityComparisonChart
- ModelMetricsTable
- FeatureImportanceChart
- DataFreshnessBadge
- SourceAttribution
- ForecastConfidenceBand
- EnvironmentalStatusIndicator
- DateRangeSelector
- ThemeToggle

Use typed API clients.

Avoid large monolithic page components.

---

# 18. MACHINE LEARNING EXPLAINABILITY

Implement appropriate model explanations.

Possible approaches:

- SHAP
- Permutation importance
- Feature importance
- Partial dependence plots

Requirements:

- Explain what each chart actually means.
- Avoid presenting correlation as causation.
- Do not claim that feature importance proves why pollution occurred.
- Use honest labels.
- Keep explanations understandable to nontechnical users.

---

# 19. UNCERTAINTY ESTIMATION

Implement forecast uncertainty only if it can be supported and evaluated.

Preferred approach:

Use rolling backtest residuals to estimate horizon-specific prediction intervals.

Consider conformal prediction or another defensible calibration method.

Evaluate interval coverage on held-out data.

Do not label arbitrary percentages as model confidence.

If reliable uncertainty estimates cannot be produced, omit the intervals and explain why.

---

# 20. DATA REFRESH AND AUTOMATION

Implement background jobs for:

- Updating recent observations
- Refreshing cached data
- Generating forecasts
- Recording ingestion results
- Detecting API failures

Choose refresh frequencies based on the source's actual update frequency and usage limits.

Ensure jobs are idempotent.

Prevent duplicate ingestion.

Avoid repeated expensive API calls when multiple users request the same city.

---

# 21. TESTING REQUIREMENTS

Write meaningful automated tests.

## Data pipeline tests

- API response parsing
- Missing values
- Duplicate timestamps
- Unit consistency
- Timezone handling
- Data merging
- Rate-limit handling

## ML tests

- Feature schema consistency
- Leakage prevention
- Forecast horizon correctness
- Model artifact loading
- Reproducible inference
- Baseline comparison
- Valid prediction timestamps

## Backend tests

- Endpoint responses
- Input validation
- Error handling
- Database operations
- Health checks

## Frontend tests

- Critical component rendering
- City search
- Forecast chart rendering
- Loading states
- API failure handling
- Theme switching

## End-to-end tests

Verify the complete journey:

Search city → Fetch real data → Display observations → Generate ML forecast → Render 72-hour chart.

Do not claim tests passed unless they were executed successfully.

---

# 22. DEPLOYMENT

Provide a working Docker Compose setup.

Suggested services:

- frontend
- backend
- postgres

Use persistent volumes.

Implement health checks.

Provide environment templates.

Do not commit secrets.

Ensure the system can be started with a documented command such as:

docker compose up --build

Document any initialization and model-training commands.

The frontend should connect to the backend correctly in both local and containerized environments.

---

# 23. DOCUMENTATION

Create:

README.md

docs/ARCHITECTURE.md

docs/DATA_SOURCES.md

docs/ML_METHODOLOGY.md

docs/API.md

docs/DEPLOYMENT.md

docs/LIMITATIONS.md

docs/PROJECT_STRUCTURE.md

The README must include:

- Project overview
- Screenshots if actually generated
- Feature list
- Architecture
- Installation
- Environment setup
- Historical data collection
- Model training
- Running the application
- Running tests
- Deployment
- Known limitations

Do not claim features are complete if they are not implemented.

---

# 24. PROJECT STRUCTURE

Use a clean monorepo.

Suggested structure:

atmosphere-ai/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── integrations/
│   │   └── ml/
│   │       ├── ingestion/
│   │       ├── preprocessing/
│   │       ├── features/
│   │       ├── training/
│   │       ├── evaluation/
│   │       ├── inference/
│   │       └── artifacts/
│   └── tests/
│
├── infrastructure/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md

You may improve this structure if there is a clear architectural reason.

---

# 25. IMPLEMENTATION STRATEGY

Execute the project in logical phases.

However, this is a SINGLE autonomous build assignment.

Do not stop after each phase waiting for approval.

## Phase 1 — Research and validation

- Verify actual APIs.
- Inspect response schemas.
- Check historical coverage.
- Select the final forecasting methodology.
- Document assumptions.

## Phase 2 — Backend foundation

- Set up FastAPI.
- Configure PostgreSQL.
- Implement migrations.
- Implement API integrations.
- Implement city search.
- Implement historical ingestion.

## Phase 3 — ML pipeline

- Collect representative historical data.
- Analyze missingness and coverage.
- Engineer features.
- Train baselines.
- Train classical ML models.
- Backtest correctly.
- Save the best model.
- Implement inference.

## Phase 4 — Frontend design system

- Establish brand identity.
- Implement typography.
- Implement colors.
- Implement layout.
- Implement dark/light themes.
- Build reusable components.

## Phase 5 — Application screens

Implement all required screens.

Connect every screen to real backend endpoints.

## Phase 6 — Live integration

- Connect city selection to actual APIs.
- Implement latest-observation retrieval.
- Implement ML inference.
- Implement scheduled refresh.
- Implement caching.
- Handle unavailable data.

## Phase 7 — Quality assurance

- Run tests.
- Fix failures.
- Run frontend linting.
- Run TypeScript checks.
- Validate Docker configuration.
- Verify end-to-end workflows.

## Phase 8 — Final delivery

- Finalize documentation.
- Report implemented features.
- Report test results.
- Report known limitations.
- Provide exact startup instructions.

---

# 26. PERFORMANCE REQUIREMENTS

Avoid unnecessary API calls.

Cache frequently requested locations.

Use database indexes.

Avoid loading huge historical datasets into browser memory.

Use server-side aggregation where appropriate.

Optimize chart rendering.

Lazy-load expensive map components when beneficial.

Use efficient data serialization.

Avoid blocking API requests with expensive model training.

Training should be a separate process from normal inference.

---

# 27. SECURITY AND RELIABILITY

Implement:

- Input validation
- Safe configuration management
- No hardcoded secrets
- CORS configuration
- Dependency management
- Request timeouts
- Controlled retries
- Proper exception handling
- Graceful API degradation
- Safe database queries
- Logging without exposing sensitive data

Use sensible production defaults.

---

# 28. STRICT ACCEPTANCE CRITERIA

The project is complete only when:

1. The Next.js frontend runs.
2. The FastAPI backend runs.
3. PostgreSQL is connected.
4. Worldwide city search works.
5. Actual environmental data can be retrieved.
6. Historical data can be ingested and stored.
7. The ML training pipeline runs.
8. At least one classical ML model is trained and saved.
9. The model can generate 72 hourly predictions.
10. The frontend displays actual model predictions.
11. Current observations and forecasts are clearly distinguished.
12. Historical charts use real data.
13. The global map is interactive.
14. The Model Intelligence screen displays actual evaluation results.
15. Dark and light themes work.
16. The application is responsive.
17. API failures are handled gracefully.
18. Tests execute successfully, or remaining failures are explicitly reported.
19. Docker deployment is configured and validated as far as the environment permits.
20. The README contains accurate setup instructions.

Do not substitute hardcoded responses for functional backend integrations.

Do not claim successful training without a real trained model artifact.

Do not claim a deployment works unless it has been tested.

---

# 29. AUTONOMOUS EXECUTION RULES

You are authorized to create, edit, organize, and refactor files within this project workspace.

You may install necessary dependencies.

You may run terminal commands, tests, builds, and training jobs.

Do not modify unrelated projects or files outside the workspace.

Do not delete user data.

Do not require approval for ordinary implementation decisions.

Maintain a running implementation checklist in:

docs/IMPLEMENTATION_STATUS.md

Update it as you progress.

If the environment imposes limitations:

1. Record the limitation.
2. Implement everything possible.
3. Avoid false claims.
4. Continue with independent work.
5. Provide precise instructions for the remaining dependency.

Prioritize a working end-to-end vertical slice before implementing optional enhancements.

Do not spend all available time polishing UI while leaving the ML pipeline incomplete.

Do not spend all available time tuning models while leaving the application unusable.

Balance data engineering, ML quality, backend functionality, frontend excellence, and operational reliability.

---

# 30. FINAL QUALITY STANDARD

The final application should demonstrate:

### Strong machine learning engineering
Real training, valid backtesting, reproducible inference, model comparison, and honest evaluation.

### Strong data engineering
Reliable ingestion, correct timestamps, provenance, quality checks, and persistent storage.

### Strong backend engineering
Clean APIs, maintainable services, validation, caching, and robust error handling.

### Exceptional frontend engineering
A visually outstanding, responsive, intuitive, and interactive Next.js dashboard.

### Strong product thinking
Clear user journeys, useful information, meaningful interactions, and transparent limitations.

The project must look and behave like a serious environmental intelligence platform, not a university assignment template.

---

# 31. START NOW

Begin immediately.

First inspect the workspace and available development environment.

Then validate the actual environmental APIs and their data coverage.

Select a scientifically defensible 72-hour forecasting strategy.

Create the implementation plan and track progress.

Build the application end-to-end.

Train and evaluate the models using real historical data.

Implement the premium frontend.

Connect live API retrieval to genuine ML inference.

Run the available tests and builds.

Fix discovered issues.

Finish with:

1. What was implemented.
2. Which real data sources were used.
3. What models were trained.
4. Actual evaluation results.
5. How to start the application.
6. Which features were verified.
7. Any remaining limitations.

Do not stop at a plan.

Build ATMOSPHERE AI.