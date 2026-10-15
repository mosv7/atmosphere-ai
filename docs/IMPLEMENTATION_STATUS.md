# Implementation status

Verified October 15, 2026. Build branch: `codex/build-atmosphere-ai`.

## Delivery checklist

- [x] Read the complete brief and inspect the empty workspace.
- [x] Validate live geocoding, air-quality history/current and historical weather responses.
- [x] Document architecture, interfaces, provenance and scientific limitations.
- [x] Implement FastAPI, PostgreSQL entities, Alembic migration and resilient source adapters.
- [x] Collect real historical data and train/evaluate classical estimators.
- [x] Save immutable versioned artifacts and generate/persist 72 genuine hourly predictions.
- [x] Implement all eight connected Next.js screens, worldwide search, charts and map.
- [x] Implement historical map time controls using actual stored records.
- [x] Verify dark/light themes, responsive navigation, missing data and retry states.
- [x] Execute backend/ML tests, frontend tests, lint, typecheck and production build.
- [x] Execute browser journeys against native production and Docker deployments.
- [x] Build both Docker images, verify persistent volumes, readiness and migrations.
- [x] Complete documentation, screenshots, evaluation evidence and limitations.

## Actual data and model evidence

Live source probes returned Cairo's geocoding record, 2,232 hourly air-quality rows for a 92-day-plus-current-day request, and 168 rows for January 1-7, 2025. All six pollutants were in micrograms/m3. Weather variables and units were inspected. The adapter explicitly requests wind in m/s.

Native collection persisted **70,032 hourly air-quality records and 70,032 weather records** across eight cities over October 16, 2025 through the partial current day, October 15, 2026. Missing PM2.5 count was zero in this collection. Later browsing can add real source records without changing this saved training snapshot's reported metrics.

Compared persistence and seasonal-naive baselines with trained Ridge, Random Forest, LightGBM and XGBoost. LightGBM won on validation MAE 10.6625 micrograms/m3. Known-city future-period test MAE was **8.5785**, RMSE **14.3597**. Held-out Nairobi MAE was **4.0520**, RMSE **5.0094**. XGBoost's slightly lower test MAE did not influence selection.

Native artifact: `backend/artifacts/cams-direct-20261015T174956Z-e65398d9/model.joblib`. Its SHA-256, dataset hash, split boundaries, dependency versions and compact metrics are recorded in `docs/ML_EVALUATION.json`. `python -m app.ml.evaluate --recompute` successfully recalculated metrics from saved target/prediction pairs. The database registers the exact immutable artifact version.

Live GET and POST inference returned exactly 72 finite, nonnegative, consecutive hourly values after issuance. Successful runs and all values persist in PostgreSQL. Nairobi current data succeeds while unsupported model inference returns an explanatory 409.

These are retrospective CAMS model-estimate results, not station-observation accuracy or proof of historical issue-time availability. Coverage is limited to seven training cities. Intervals are explicitly unavailable. Full methodology and limitations are documented.

## Final verification

| Check | Executed result |
|---|---|
| Python backend and ML | `python -m pytest -q --disable-warnings`: **25 passed**, one upstream TestClient warning |
| Fresh native PostgreSQL migration | Alembic upgrade succeeded; `alembic check`: no pending operations |
| Frontend unit tests | `npm test`: **14 passed**, four test files |
| Frontend lint | `npm run lint`: passed |
| Frontend types | `npm run typecheck`: passed |
| Native production build | `npm run build`: passed, all eight routes |
| Native production browser journeys | **7 passed** in 17.6 seconds, http://127.0.0.1:3000 |
| Docker browser journeys | **7 passed** in 18.5 seconds, http://127.0.0.1:13000 |
| Docker images | Backend and frontend successfully built from Dockerfiles with locked dependencies |
| Docker readiness | PostgreSQL, backend and frontend reported healthy |
| Docker schema | Migration succeeded; `alembic check` clean |
| Container artifact permissions | Nonroot uid 1000 created/read/removed a temporary file on the named model volume |
| Production npm audit | Zero vulnerabilities; five high development-only ESLint-chain advisories remain |
| Premium static UI audit | Strict mode: zero findings; evidence in `premium-audit.json` |
| Python dependencies | `pip check`: no broken requirements |
| UTF-8 content scan | Zero replacement characters in application source and documentation |
| Native startup helper | `scripts/start-local.ps1` executed successfully against the workspace services |

The seven browser journeys cover:

1. Real overview -> genuine forecast refresh POST -> 72-row chart/table, pagination and horizon changes.
2. Worldwide search -> London selection -> persistence across navigation/reload.
3. All analysis routes, actual model leaderboard and two-city comparison.
4. Theme persistence, 390px mobile navigation and absence of horizontal overflow.
5. Injected 503 failure -> actionable message -> successful retry with real data.
6. Actual map zoom/location selection -> Nairobi source data with honest unsupported forecast coverage.
7. Historical map control -> real snapshot timestamps at/before the selected cutoff.

Browser: installed Microsoft Edge via Playwright because the Browser plugin was unavailable. Desktop viewport 1440x1000; mobile 390x844. Screenshots in `docs/screenshots` were visually inspected against the generated concept. Screenshot capture waits for data/map loading and disables unfinished CSS transitions.

## Container training verification

A separate Docker database collected 45 days across eight cities: **8,600 real AQ records** plus corresponding weather. Training actually ran inside the nonroot backend container and selected Ridge Regression, version `cams-direct-20261015T180414Z-020c0ce3`, test MAE 9.8246. This smoke artifact and its data are separate from the native one-year LightGBM experiment. Docker's frontend proxy rendered this genuine model output and passed the same seven browser journeys.

Verification used alternate host ports 5543/18000/13000 to preserve native services. Container volumes remain persistent; the verification stack is stopped after checks. The native application remains available at http://127.0.0.1:3000 with API docs at http://127.0.0.1:8000/docs.

## Review corrections

Independent review plus browser inspection found and corrected:

- Forecast cache reuse across an hour rollover and stale origins producing obsolete target times.
- Model artifact overwrites and registry/artifact version mismatches.
- Retraining coverage that could include cities absent from fitting/validation.
- Fresh Linux artifact volume permissions, unlocked Docker dependencies and proxy trust configuration.
- Map worker loading and a stylesheet collision that collapsed its container to zero height.
- Cross-city cache corruption when a forecast refresh finished after city selection changed.
- Feature importance incorrectly following the active model rather than the selected model version.
- Weather unit encoding and light-theme chart contrast.

Regression tests cover the state/inference defects; scoped independent re-reviews accepted the fixes.

## Practical limits

See `docs/LIMITATIONS.md`. Public internet hosting was not performed. CI configuration is supplied but no remote CI run is claimed. No Git remote is configured, so no push or PR was possible. External provider/tiles availability, commercial API licensing, uncertainty calibration, broader geographic evaluation, and multi-worker operational hardening remain explicit deployment/scientific limitations.

Nonfatal tooling notices include the Starlette/httpx TestClient deprecation, a future Vite config-loader notice, and a Next.js standalone-output warning when native `next start` is used. Native production browser journeys passed; Docker uses the generated standalone server entry directly. No remaining executed test or build failure is hidden.
