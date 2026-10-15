# Atmosphere AI frontend

Next.js App Router / TypeScript frontend for the environmental intelligence platform. See root README for database, backend and model initialization.

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Browser requests use same-origin `/api`; Next rewrites to `BACKEND_URL` (default http://127.0.0.1:8000). This value is used at build time for production. Docker supplies http://backend:8000. `npm ci` copies the version-matched MapLibre worker and distribution license notices to public assets, avoiding bundler worker URL errors.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run test:e2e
```

E2E requires live backend data/model and an installed Edge browser. Unit tests cover missing values, timezone formatting, API error propagation, loading/retry states, debounced city search, IME/stale results, keyboard selection, chart series and theme persistence.

Eight routes: `/`, `/city`, `/forecast`, `/explorer`, `/comparison`, `/models`, `/data`, `/status`. All environmental values come from backend responses. CAMS source estimates remain distinct from trained model predictions; uncertainty is only displayed when returned. Search has worldwide coverage; model inference is limited to evaluated cities. Theme/city preferences persist in browser storage.

Map tiles/styles use CARTO and OpenStreetMap cartography and require external network access. An accessible city selector remains available if cartography fails. Markers only represent city locations and available point concentrations, never continuous geographical pollution coverage. Concept design: design/overview-concept.png. Runtime tokens and behavioral ownership: ../DESIGN.md.
