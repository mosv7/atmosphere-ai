# Data sources and provenance

Verified against documentation and live responses on October 15, 2026.

## Open-Meteo air quality / CAMS

Documentation: https://open-meteo.com/en/docs/air-quality-api
Endpoint: https://air-quality-api.open-meteo.com/v1/air-quality

This product uses gridded atmospheric model estimates, **not direct station measurements**. CAMS global composition is approximately 0.4 degrees / 45 km, natively three-hourly, exposed as hourly series by the provider. European CAMS is approximately 11 km. A city coordinate selects a grid cell; it is not a street-level sensor. Different domains may disagree. The map shows individual locations, never an invented continuous pollution heatmap.

The documented global archive begins August 2022. European forecast history begins October 2023; European reanalysis is separately documented from 2013. The adapter does not assume every domain, pollutant or date range has identical coverage. It validates returned rows and records nulls rather than filling invented values.

Live Cairo probes returned 2,232 hourly rows for past_days=92 plus the current date, and 168 hourly rows for January 1–7, 2025 using start_date/end_date on the same endpoint. This confirms those requests for that location, not unlimited global historical coverage. All six requested pollutants (PM2.5, PM10, NO2, O3, SO2, CO) were in micrograms per cubic meter. CO uses the same concentration unit, not milligrams.

Global CAMS updates approximately every 12 hours; European CAMS forecast updates approximately every 24 hours. Hourly output resolution does not mean hourly model regeneration. The application records retrieval and valid timestamps separately and filters future upstream air-quality values out of observation storage. Forecasts shown as Atmosphere AI predictions come from our own saved classical estimator.

Archive estimates may be revised. Historical valid timestamps do not prove when a particular version was first available. Retrospective backtests on today's downloaded archive cannot establish operational, issuance-time performance. See ML_METHODOLOGY.md.

## Weather

Historical documentation: https://open-meteo.com/en/docs/historical-weather-api
Forecast documentation: https://open-meteo.com/en/docs

Archive weather is reanalysis, not an archived forecast issued at a historical forecast origin. Recent weather uses the weather forecast endpoint and is also model-derived. Variables: temperature at 2 m (C), humidity (%), wind at 10 m (m/s explicitly requested by adapter), wind direction (degrees), surface pressure (hPa), precipitation (mm). Weather is stored and displayed separately. No future weather values enter the initial pollution model.

## Geocoding

Documentation: https://open-meteo.com/en/docs/geocoding-api
Endpoint: https://geocoding-api.open-meteo.com/v1/search

GeoNames-backed results include stable provider IDs, country, region, coordinates and IANA timezone. Duplicate city names are shown with their countries/regions. Seeded city coordinates are configuration, not fabricated environmental data. Search does not imply validated model coverage.

## Attribution, access and deployment

Credit Open-Meteo, CAMS / Copernicus Atmosphere Monitoring Service and the applicable CAMS data contributors; geocoding credits GeoNames. Data is subject to the provider's attribution and licensing requirements, including CC BY 4.0 where applicable. See https://open-meteo.com/en/licence and https://open-meteo.com/en/terms for the authoritative terms, and the CAMS acknowledgement linked in the air-quality API documentation.

The free public endpoint is intended for non-commercial use. At verification, published limits were 600 calls/minute, 5,000/hour and 10,000/day. Expensive multi-location or long-range requests may count as multiple calls. Commercial deployments must arrange the appropriate provider plan, URL and credentials; this repository's public endpoint defaults are for local/non-commercial evaluation. Limits and terms can change: verify https://open-meteo.com/en/pricing before deployment.

Retries are bounded and respect rate-limit responses. Request caching and persisted observations reduce repeated calls. Source failures remain visible; there is no synthetic fallback. Cached historical values can remain useful during outages with freshness warnings.
