"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  formatValue,
  localTime,
  pollutants,
  type Coverage,
} from "@/lib/api";
import { useEnvironment, useCities } from "@/components/providers";
import { PageTitle, Panel, useHistory } from "@/components/environment-panels";
import { QueryState } from "@/components/query-state";
import { DataTable } from "@/components/data-table";
export function DataExplorer() {
  const { city, selectCity } = useEnvironment();
  const cities = useCities();
  const [days, setDays] = useState(7);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const coverage = useQuery({
    queryKey: ["coverage"],
    queryFn: ({ signal }) => api<Coverage>("data/coverage", signal),
  });
  const history = useHistory(days);
  const records = (history.data?.records ?? []).filter(
    (row) =>
      (!start || row.timestamp.slice(0, 10) >= start) &&
      (!end || row.timestamp.slice(0, 10) <= end),
  );
  const selected = coverage.data?.cities.find((c) => c.city.id === city.id);
  return (
    <>
      <PageTitle
        title="Follow the data."
        description="Inspect what was collected, when it arrived, and what is missing."
      >
        <select
          aria-label="Data city"
          value={city.id}
          onChange={(e) => {
            const next = cities.data?.cities.find(
              (c) => c.id === e.target.value,
            );
            if (next) selectCity(next);
          }}
        >
          {(cities.data?.cities ?? [city]).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}, {c.country}
            </option>
          ))}
        </select>
        <select
          aria-label="Data collection range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[1, 7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </PageTitle>
      <Panel
        title="Source & coverage"
        subtitle={coverage.data?.source ?? "CAMS via Open-Meteo"}
      >
        {coverage.isPending || coverage.error ? (
          <QueryState
            loading={coverage.isPending}
            error={coverage.error}
            retry={() => coverage.refetch()}
          />
        ) : (
          <>
            <div className="metric-strip">
              <div className="metric">
                <small>STORED RECORDS · {city.name.toUpperCase()}</small>
                <strong>{formatValue(selected?.records, 0)}</strong>
                <span>Hourly environmental estimates</span>
              </div>
              <div className="metric">
                <small>MISSING PM2.5</small>
                <strong>{formatValue(selected?.missing_pm25, 0)}</strong>
                <span>
                  {selected?.records
                    ? `${formatValue((100 * selected.missing_pm25) / selected.records)}% of stored records`
                    : "No stored series"}
                </span>
              </div>
              <div className="metric">
                <small>LATEST INGESTION</small>
                <strong style={{ fontSize: 18 }}>
                  {localTime(selected?.latest_ingestion, city.timezone, true)}
                </strong>
                <span>{city.timezone}</span>
              </div>
            </div>
            <DataTable
              headers={[
                "City",
                "Records",
                "Start · local",
                "End · local",
                "Missing PM2.5",
              ]}
              rows={(coverage.data?.cities ?? []).map((c) => [
                c.city.name,
                formatValue(c.records, 0),
                localTime(c.start, c.city.timezone, true),
                localTime(c.end, c.city.timezone, true),
                formatValue(c.missing_pm25, 0),
              ])}
            />
          </>
        )}
      </Panel>
      <Panel
        title="Collected records"
        subtitle={`${city.name} · all pollutant concentrations in µg/m³`}
        action={
          <div className="inline-controls">
            <label>
              From UTC{" "}
              <input
                type="date"
                aria-label="Filter records from date UTC"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              To UTC{" "}
              <input
                type="date"
                aria-label="Filter records to date UTC"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
        }
      >
        {history.isPending || history.error ? (
          <QueryState
            loading={history.isPending}
            error={history.error}
            retry={() => history.refetch()}
          />
        ) : (
          <DataTable
            headers={["Source time · local", ...pollutants.map((p) => p.label)]}
            rows={records
              .slice()
              .reverse()
              .map((row) => [
                localTime(row.timestamp, city.timezone, true),
                ...pollutants.map((p) => formatValue(row[p.key], 2)),
              ])}
          />
        )}
      </Panel>
      <div className="split-grid">
        <Panel
          title="Variables & missingness"
          subtitle="Statistics for the filtered source records"
        >
          <div className="metadata-list">
            {pollutants.map((p) => (
              <div className="metadata-row" key={p.key}>
                <span>{p.label} · µg/m³</span>
                <span>
                  {records.filter((r) => r[p.key] != null).length} present ·{" "}
                  {records.filter((r) => r[p.key] == null).length} missing
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Reading this dataset" subtitle="Source provenance">
          <div className="content-padding coverage-note">
            These are atmospheric model estimates from Copernicus CAMS, served
            through Open-Meteo. They are not ground station measurements.
            Collection time and source time are distinct. Historical archive
            revisions and issue-time availability are not established;
            retrospective model evaluation must be interpreted accordingly.
            Missing pollutant values remain missing.
            <br />
            <br />
            Weather context is available on City intelligence when retrieved.
            Weather is not an input to the forecasting model; future realized
            weather is never used.
          </div>
        </Panel>
      </div>
    </>
  );
}
