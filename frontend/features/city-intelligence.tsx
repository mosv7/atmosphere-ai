"use client";
import { useState } from "react";
import {
  CityInspector,
  HistoryPanel,
  PageTitle,
  Panel,
  useCurrent,
  useHistory,
} from "@/components/environment-panels";
import { useEnvironment } from "@/components/providers";
import { formatValue, localTime, pollutants, type Pollutant } from "@/lib/api";
import { DataChart } from "@/components/data-chart";
import { QueryState, Notice } from "@/components/query-state";
export function CityIntelligence() {
  const { city } = useEnvironment();
  const [days, setDays] = useState(7);
  const [pollutant, setPollutant] = useState<Pollutant>("pm25");
  const current = useCurrent();
  const history = useHistory(days);
  const values = (history.data?.records ?? []).filter(
    (r) => r[pollutant] != null,
  );
  const mean = values.length
    ? values.reduce((sum, r) => sum + r[pollutant]!, 0) / values.length
    : null;
  const sd =
    mean != null
      ? Math.sqrt(
          values.reduce((sum, r) => sum + (r[pollutant]! - mean) ** 2, 0) /
            values.length,
        )
      : null;
  const anomalies =
    mean != null && sd != null
      ? values.filter((r) => Math.abs(r[pollutant]! - mean) > 3 * sd)
      : [];
  const hourly = new Map<number, number[]>();
  for (const row of values) {
    const hour = Number(
      new Intl.DateTimeFormat("en", {
        timeZone: city.timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(row.timestamp)),
    );
    hourly.set(hour, [...(hourly.get(hour) ?? []), row[pollutant]!]);
  }
  const daily = new Map<
    string,
    { timestamp: string; sum: number; count: number }
  >();
  for (const row of values) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: city.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(row.timestamp));
    const previous = daily.get(day);
    daily.set(day, {
      timestamp: previous?.timestamp ?? row.timestamp,
      sum: (previous?.sum ?? 0) + row[pollutant]!,
      count: (previous?.count ?? 0) + 1,
    });
  }
  return (
    <>
      <PageTitle
        title={`${city.name}, in detail.`}
        description={`An environmental profile built from source estimates · ${city.country}`}
      >
        <select
          aria-label="History pollutant"
          value={pollutant}
          onChange={(e) => setPollutant(e.target.value as Pollutant)}
        >
          {pollutants.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="segmented" aria-label="History range">
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
      </PageTitle>
      <div className="detail-grid">
        <div>
          <HistoryPanel days={days} pollutant={pollutant} />
          <Panel
            title="Weather context"
            subtitle="Latest source weather values"
          >
            {current.isPending || current.error ? (
              <QueryState
                loading={current.isPending}
                error={current.error}
                retry={() => current.refetch()}
              />
            ) : current.data?.weather ? (
              <div className="weather-list">
                {[
                  ["temperature", "Temperature", "°C"],
                  ["humidity", "Humidity", "%"],
                  ["wind_speed", "Wind speed", "m/s"],
                  ["wind_direction", "Wind direction", "°"],
                  ["pressure", "Pressure", "hPa"],
                  ["precipitation", "Precipitation", "mm"],
                ].map(([key, label, unit]) => (
                  <div key={key} className="weather-item">
                    <small>
                      {label} · {unit}
                    </small>
                    <strong>{formatValue(current.data?.weather?.[key])}</strong>
                  </div>
                ))}
                <p className="weather-provenance">
                  Source: {String(current.data.weather.source ?? "Open-Meteo")}{" "}
                  ·{" "}
                  {localTime(
                    typeof current.data.weather.timestamp === "string"
                      ? current.data.weather.timestamp
                      : undefined,
                    city.timezone,
                    true,
                  )}
                </p>
              </div>
            ) : (
              <div className="empty-inline">
                Weather data is unavailable for this source time.
              </div>
            )}
          </Panel>
        </div>
        <CityInspector />
      </div>
      <div className="split-grid">
        <Panel
          title="Hourly rhythm"
          subtitle={`Mean concentration by local hour · ${city.timezone}`}
        >
          <div className="feature-bars">
            {history.isPending || !values.length ? (
              <QueryState
                loading={history.isPending}
                error={history.error}
                empty={!values.length}
              />
            ) : (
              Array.from(hourly)
                .sort((a, b) => a[0] - b[0])
                .map(([hour, samples]) => {
                  const avg =
                    samples.reduce((a, b) => a + b, 0) / samples.length;
                  const max = Math.max(...values.map((v) => v[pollutant]!));
                  return (
                    <div className="feature-row" key={hour}>
                      <div>
                        <span>{`${hour}`.padStart(2, "0")}:00</span>
                        <span>{formatValue(avg)} µg/m³</span>
                      </div>
                      <div className="feature-track">
                        <span
                          style={{ width: `${max ? (100 * avg) / max : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </Panel>
        <div>
          <Panel
            title="Recent anomalies"
            subtitle="Values more than 3 standard deviations from the selected period mean"
          >
            {anomalies.length ? (
              <div className="metadata-list">
                {anomalies
                  .slice(-10)
                  .reverse()
                  .map((row) => (
                    <div className="metadata-row" key={row.timestamp}>
                      <span>
                        {localTime(row.timestamp, city.timezone, true)}
                      </span>
                      <span>{formatValue(row[pollutant])} µg/m³</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-inline">
                {values.length
                  ? "No values meet this statistical threshold."
                  : "No collected values to analyze."}
              </div>
            )}
            <Notice>
              Statistical deviations do not establish a cause or a health event.
            </Notice>
          </Panel>
          <Panel
            title="Data availability"
            subtitle="Coverage of the selected period"
          >
            <div className="metadata-list">
              <div className="metadata-row">
                <span>Stored records</span>
                <span>{history.data?.records.length ?? "—"}</span>
              </div>
              <div className="metadata-row">
                <span>Available pollutant values</span>
                <span>{values.length}</span>
              </div>
              <div className="metadata-row">
                <span>Source</span>
                <span>{history.data?.source ?? "Awaiting source"}</span>
              </div>
              <div className="metadata-row">
                <span>Period average</span>
                <span>{formatValue(mean)} µg/m³</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      {values.length > 0 && (
        <Panel
          title="Daily picture"
          subtitle="Daily mean of collected source estimates · city local days"
        >
          <DataChart
            series={[
              {
                name: pollutants.find((p) => p.key === pollutant)!.label,
                data: Array.from(daily.values()).map((r) => [
                  r.timestamp,
                  r.sum / r.count,
                ]),
              },
            ]}
          />
        </Panel>
      )}
    </>
  );
}
