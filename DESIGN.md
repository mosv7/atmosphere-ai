# Atmosphere AI design and interaction system

Product register: environmental intelligence dashboard, English worldwide audience. Source evidence: supplied master brief and docs/IMPLEMENTATION_PLAN.md. The generated primary specification is frontend/design/overview-concept.png; its map composition, quiet navy palette, orbital identity, side navigation, roomy type and inspector hierarchy govern implementation. Generated with the built-in ImageGen tool; prompt requests the complete dashboard with honest unavailable states and no fabricated environmental numbers.

## Runtime tokens
frontend/app/globals.css owns all runtime tokens. Dark canvas #080f18, surface #101b27, raised surface #142331, text #edf3f8, secondary text #9dadbf, boundary #253747, emerald #52e0ac, cyan #7ccee8. Light theme uses cool pale #f3f6f8 canvas, white surfaces, #142738 text, #526676 secondary, #d9e2e8 boundaries and deep #087b59 emerald. Theme does not simply invert. Font: Arial/system sans with compact editorial headlines, monospace numeric readouts; 12px utility, 14px body, 20px panels, 42px page title. Sidebar 216px, main gutter 32px, 10px panel radius, thin boundaries; chart and map dominate, metrics remain open rows. Lucide icons, 18px, 1.7 stroke. Animations only short state changes, reduced motion respected.

## Canonical behavior and ownership
AppShell owns navigation, theme and responsive mobile menu. Providers own selected city and query cache. CitySearch owns 300ms debounce, cancellation, keyboard list navigation, clear and no-result/error state. Native select owns filters with platform keyboard semantics. Shared Button owns actions/focus/busy. QueryState owns skeleton/error/retry/empty. DataChart owns all scientific chart appearance and timezone-aware tooltips. AirMap owns geographic display; markers represent listed cities, never a heatmap. Tables own local pagination (24 rows), native semantic markup and horizontal scrolling. Global stylesheet owns scrollbars and focus contrast.

City selection persists between routes and locally; all display times use selected city timezone (explicitly shown). Query cancellation prevents stale results. Data remains in UTC internally. Current source estimates, stored history and ML predictions use distinct labels. No guessed concentrations, health categories or operational greens. Forecast intervals only appear when returned; unknown availability is stated. Map cartography is external geographic context, not pollution coverage. Search, selection and theme controls remain available on failure.

Desktop map/inspector becomes a deliberate vertical flow below 1100px. Below 760px the sidebar becomes a controlled drawer and toolbar wraps; charts retain 260px height, tables scroll within their own panel. Escape closes navigation/search, focus styles stay visible. All persistent feedback is inline and announced. No destructive workflows exist.

## Verification

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | native select and CitySearch combobox | DESIGN.md | platform native filter, authored searchable cities | tests/frontend.test.tsx and frontend/e2e/live.spec.ts |
| Scrollbar | frontend/app/globals.css | DESIGN.md runtime tokens | global thin, table geometry | frontend/e2e/live.spec.ts responsive overflow |

## Executed evidence

Global Explorer Map time owns Latest / 24 hours ago / 7 days ago. Historical point colors use actual stored source records at or before the backend cutoff, with the timestamp shown in city local time. These are retrospective archive estimates, not historical issue-time snapshots. Missing historical city records remain gray; city inspector remains explicitly latest. The query identity includes the time offset and selected city. frontend/lib/map-data.ts owns bounded selected/monitoring-city request composition, tested in frontend/tests/map-data.test.ts.

Scientific chart colors are adapted in frontend/lib/chart-theme.ts. Dark emerald/cyan/amber/purple/red map to light #087b59/#08779a/#946112/#7651a4/#b64250. The adapter also translates explicit dark-series colors, including forecast lines and uncertainty bounds; both DataChart and Model Intelligence use this canonical palette. Theme transitions are covered by a rendered chart-adapter test.

Production build, lint, typecheck passed. Vitest 14 tests passed, covering formatting, missing values, API errors, loading/retry, keyboard search, IME/stale responses, chart theme transitions, historical snapshot requests, cross-city mutation races and model-version explanations. Seven live browser journeys passed against both native and Docker production servers. Production npm audit reports zero vulnerabilities; five high advisories remain in the development ESLint dependency chain. Premium strict audit reports zero findings. Browser screenshots live in docs/screenshots and were visually compared with the saved concept.
npm run typecheck; npm run lint; npm test; npm run build. Root owns final browser visual/E2E checks using Playwright Edge because Browser plugin is unavailable. Compare browser screenshot with frontend/design/overview-concept.png; practical map is geographically truthful basemap rather than raster UI.
