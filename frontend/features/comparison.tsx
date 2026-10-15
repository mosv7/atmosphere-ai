"use client";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  api,
  formatValue,
  localTime,
  type City,
  type Current,
  type Forecast,
  type History,
  type Pollutant,
} from "@/lib/api";
import { useEnvironment } from "@/components/providers";
import { PageTitle, Panel } from "@/components/environment-panels";
import { CitySearch } from "@/components/city-search";
import { QueryState, Notice } from "@/components/query-state";
import { DataChart } from "@/components/data-chart";
import { DataTable } from "@/components/data-table";
export function Comparison() {
  const { city } = useEnvironment();
  const [selected, setSelected] = useState<City[]>([city]);
  const [pollutant, setPollutant] = useState<Pollutant>("pm25");
  const [days, setDays] = useState(7);
  const ids = selected.map((c) => c.id).join(",");
  const current = useQuery({
    queryKey: ["comparison", ids],
    queryFn: ({ signal }) =>
      api<{ cities: Current[] }>(
        `analytics/city-comparison?city_ids=${encodeURIComponent(ids)}`,
        signal,
      ),
    enabled: selected.length >= 2,
  });
  const histories = useQueries({
    queries: selected.map((c) => ({
      queryKey: ["history", c.id, days],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<History>(
          `air-quality/history?city_id=${encodeURIComponent(c.id)}&days=${days}`,
          signal,
        ),
    })),
  });
  const forecasts = useQueries({
    queries: selected.map((c) => ({
      queryKey: ["forecast", c.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<Forecast>(
          `forecast/72h?city_id=${encodeURIComponent(c.id)}`,
          signal,
        ),
      retry: false,
    })),
  });
  return (
    <>
      <PageTitle
        title="Different cities. Shared air."
        description="Compare 2–5 cities on the same scale, with the same source."
      />
      <div className="comparison-search">
        {selected.length < 5 && (
          <CitySearch
            placeholder="Add a city to compare..."
            onSelect={(next) =>
              setSelected((list) =>
                list.some((c) => c.id === next.id) ? list : [...list, next],
              )
            }
          />
        )}
      </div>
      <div className="selected-chips">
        {selected.map((c) => (
          <span className="city-chip" key={c.id}>
            {c.name}
            <button
              aria-label={`Remove ${c.name}`}
              disabled={selected.length === 1}
              onClick={() =>
                setSelected((list) => list.filter((item) => item.id !== c.id))
              }
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      {selected.length < 2 && (
        <Notice>
          Add a second city using the search above to begin your comparison.
        </Notice>
      )}
      <div className="page-controls" style={{ marginBottom: 20 }}>
        <select
          aria-label="Comparison pollutant"
          value={pollutant}
          onChange={(e) => setPollutant(e.target.value as Pollutant)}
        >
          <option value="pm25">PM2.5</option>
          <option value="pm10">PM10</option>
        </select>
        <select
          aria-label="Comparison range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[1, 7, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "24 hours" : `${d} days`}
            </option>
          ))}
        </select>
      </div>
      <Panel
        title="Current perspective"
        subtitle="Latest available source estimate for each city"
      >
        {selected.length < 2 ? (
          <div className="empty-inline">
            Choose at least two cities to compare their latest conditions.
          </div>
        ) : current.isPending || current.error ? (
          <QueryState
            loading={current.isPending}
            error={current.error}
            retry={() => current.refetch()}
          />
        ) : (
          <DataTable
            headers={[
              "City",
              "PM2.5 · µg/m³",
              "PM10 · µg/m³",
              "Source time · city local",
              "Age · hours",
            ]}
            rows={(current.data?.cities ?? []).map((c) => [
              c.city.name,
              formatValue(c.observation?.pm25),
              formatValue(c.observation?.pm10),
              localTime(c.observation?.timestamp, c.city.timezone, true),
              formatValue(c.age_hours),
            ])}
          />
        )}
      </Panel>
      <Panel
        title="History, side by side"
        subtitle="Synchronized time axis · hover for comparable concentrations"
      >
        {histories.every((q) => q.isPending) ? (
          <QueryState loading />
        ) : (
          <DataChart
            height={330}
            series={histories.flatMap((q, index) =>
              q.data
                ? [
                    {
                      name: selected[index].name,
                      data: q.data.records.map(
                        (row) =>
                          [row.timestamp, row[pollutant]] as [
                            string,
                            number | null,
                          ],
                      ),
                    },
                  ]
                : [],
            )}
          />
        )}{" "}
        {histories.map(
          (q, index) =>
            q.error && (
              <Notice key={selected[index].id}>
                {selected[index].name}: {q.error.message}
              </Notice>
            ),
        )}
      </Panel>
      <Panel
        title="72-hour forecast comparison"
        subtitle="Evaluated PM2.5 model predictions for supported cities"
      >
        {forecasts.every((q) => q.isPending) ? (
          <QueryState loading />
        ) : forecasts.some((q) => q.data) ? (
          <DataChart
            height={300}
            series={forecasts.flatMap((q, index) =>
              q.data
                ? [
                    {
                      name: selected[index].name,
                      data: q.data.values.map(
                        (row) =>
                          [row.timestamp, row.predicted_pm25] as [
                            string,
                            number,
                          ],
                      ),
                      dashed: true,
                    },
                  ]
                : [],
            )}
          />
        ) : (
          <QueryState empty label="Forecasts unavailable for these locations" />
        )}
        {forecasts.map(
          (q, index) =>
            q.error && (
              <Notice key={selected[index].id}>
                {selected[index].name}: {q.error.message}
              </Notice>
            ),
        )}
      </Panel>
    </>
  );
}
