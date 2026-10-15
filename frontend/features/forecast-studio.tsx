"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  PageTitle,
  Panel,
  useForecast,
  useHistory,
} from "@/components/environment-panels";
import { useEnvironment } from "@/components/providers";
import { DataChart, type ChartSeries } from "@/components/data-chart";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { QueryState, Notice } from "@/components/query-state";
import { api, formatValue, localTime, type Forecast } from "@/lib/api";
export function ForecastStudio() {
  const { city } = useEnvironment();
  const query = useForecast();
  const history = useHistory(7);
  const [horizon, setHorizon] = useState(72);
  const client = useQueryClient();
  const refresh = useMutation({
    mutationFn: ({ cityId }: { cityId: string; cityName: string }) =>
      api<Forecast>("forecast/generate", undefined, { city_id: cityId }),
    onSuccess: (data, variables) =>
      client.setQueryData(["forecast", variables.cityId], data),
  });
  const data = query.data;
  const values = data?.values.filter((v) => v.horizon_hours <= horizon) ?? [];
  const peak = values.reduce<(typeof values)[number] | null>(
    (best, row) =>
      !best || row.predicted_pm25 > best.predicted_pm25 ? row : best,
    null,
  );
  const average = values.length
    ? values.reduce((sum, row) => sum + row.predicted_pm25, 0) / values.length
    : null;
  const series: ChartSeries[] = [
    {
      name: "Historical CAMS estimates",
      data: (history.data?.records ?? [])
        .slice(-72)
        .map((v) => [v.timestamp, v.pm25]),
    },
    {
      name: "ML prediction",
      data: values.map((v) => [v.timestamp, v.predicted_pm25]),
      color: "#7ccee8",
      dashed: true,
    },
  ];
  const calibrated =
    !!data?.uncertainty &&
    values.some((v) => v.lower_bound != null && v.upper_bound != null);
  if (calibrated) {
    series.push(
      {
        name: "Interval lower bound",
        data: values.map((v) => [v.timestamp, v.lower_bound]),
        color: "#9dadbf",
        dashed: true,
      },
      {
        name: "Interval upper bound",
        data: values.map((v) => [v.timestamp, v.upper_bound]),
        color: "#9dadbf",
        dashed: true,
      },
    );
  }
  return (
    <>
      <PageTitle
        title="See what comes next."
        description={`The next ${horizon} hours of PM2.5 in ${city.name}. Evaluated models, explicit limits.`}
      >
        <select
          aria-label="Forecast horizon"
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value))}
        >
          {[24, 48, 72].map((h) => (
            <option key={h} value={h}>
              {h}-hour horizon
            </option>
          ))}
        </select>
        <span className="pill">PM2.5 · µg/m³</span>
        <Button
          variant="outline"
          disabled={refresh.isPending}
          onClick={() =>
            refresh.mutate({ cityId: city.id, cityName: city.name })
          }
        >
          <RefreshCw size={14} className={refresh.isPending ? "spin" : ""} />
          {refresh.isPending
            ? `Generating ${refresh.variables.cityName}…`
            : "Refresh forecast"}
        </Button>
      </PageTitle>
      {refresh.error && (
        <Notice>
          Forecast for {refresh.variables?.cityName}: {refresh.error.message}
        </Notice>
      )}
      <Panel
        title={`${city.name} · forecast`}
        subtitle="Solid: historical source estimates · Dashed: model predictions"
      >
        {query.isPending || query.error || !data ? (
          <QueryState
            loading={query.isPending}
            error={query.error}
            empty={!data}
            retry={() => query.refetch()}
          />
        ) : (
          <>
            <div className="metric-strip">
              <div className="metric">
                <small>EXPECTED PEAK</small>
                <strong>
                  {formatValue(peak?.predicted_pm25)} <small>µg/m³</small>
                </strong>
                <span>{localTime(peak?.timestamp, city.timezone, true)}</span>
              </div>
              <div className="metric">
                <small>PERIOD AVERAGE</small>
                <strong>
                  {formatValue(average)} <small>µg/m³</small>
                </strong>
                <span>Across {values.length} hourly predictions</span>
              </div>
              <div className="metric">
                <small>EXPECTED CHANGE</small>
                <strong>
                  {values.length > 1
                    ? `${formatValue(values.at(-1)!.predicted_pm25 - values[0].predicted_pm25)} µg/m³`
                    : "—"}
                </strong>
                <span>Last prediction minus first prediction</span>
              </div>
            </div>
            <DataChart
              height={360}
              series={series}
              boundary={values[0]?.timestamp}
            />
            <div className="panel-footnote">
              Issued {localTime(data.issued_at, city.timezone, true)} · Input
              source time{" "}
              {localTime(data.observation_timestamp, city.timezone, true)}
            </div>
            {!calibrated && (
              <Notice>
                Prediction intervals are omitted: no calibrated uncertainty
                estimate is available.
              </Notice>
            )}
            {data.warnings?.map((w) => (
              <Notice key={w}>{w}</Notice>
            ))}
          </>
        )}
      </Panel>
      <div className="detail-grid">
        <Panel
          title="Every hour, inspectable"
          subtitle="Predictions are estimates, not measured future conditions"
        >
          {values.length ? (
            <DataTable
              headers={[
                "Local target time",
                "Horizon",
                "Predicted PM2.5",
                ...(calibrated ? ["Lower", "Upper"] : []),
              ]}
              rows={values.map((v) => [
                localTime(v.timestamp, city.timezone, true),
                `+${v.horizon_hours}h`,
                `${formatValue(v.predicted_pm25, 2)} µg/m³`,
                ...(calibrated
                  ? [formatValue(v.lower_bound), formatValue(v.upper_bound)]
                  : []),
              ])}
            />
          ) : (
            <QueryState empty label="No predictions available" />
          )}
        </Panel>
        <Panel title="Behind the forecast" subtitle="Model provenance">
          <div className="metadata-list">
            {[
              ["Model family", data?.model_family],
              ["Version", data?.model_version],
              ["Source", data?.source],
              [
                "Coverage",
                typeof data?.coverage === "string"
                  ? data.coverage
                  : JSON.stringify(
                      data?.coverage ?? "Limited to evaluated locations",
                    ),
              ],
              [
                "Uncertainty",
                calibrated ? "Returned calibrated bounds" : "Not calibrated",
              ],
            ].map(([key, value]) => (
              <div className="metadata-row" key={key}>
                <span>{key}</span>
                <span>{value ?? "Not available"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
