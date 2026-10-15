"use client";
import { chartPalette } from "@/lib/chart-theme";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatValue, localTime, type Model } from "@/lib/api";
import { PageTitle, Panel } from "@/components/environment-panels";
import { QueryState, Notice } from "@/components/query-state";
import { DataTable } from "@/components/data-table";
import { useEnvironment } from "@/components/providers";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
const EChart = dynamic(() => import("echarts-for-react"), { ssr: false });
type Metrics = {
  mae?: number;
  rmse?: number;
  r2?: number;
  bias?: number;
  samples?: number;
};
type Leader = {
  model_name: string;
  trained: boolean;
  validation: Metrics;
  test: Metrics;
};
export function ModelLab() {
  const { city, theme } = useEnvironment();
  const query = useQuery({
    queryKey: ["models"],
    queryFn: ({ signal }) => api<{ models: Model[] }>("models", signal),
  });
  const [selected, setSelected] = useState("");
  const model =
    query.data?.models.find((m) => m.version === selected) ??
    query.data?.models.find((m) => m.active) ??
    query.data?.models[0];
  const metrics = model?.metrics;
  const importance = model?.metadata.feature_importance as
    | {
        features: { feature: string; importance: number }[];
        method: string;
        description: string;
      }
    | undefined;
  const leaderboard = (model?.metadata?.leaderboard ?? []) as Leader[];
  const horizon = Object.entries(
    (metrics?.by_horizon ?? {}) as Record<string, Metrics>,
  );
  const byCity = Object.entries(
    (metrics?.by_city ?? {}) as Record<string, Metrics>,
  );
  const max = Math.max(
    ...(importance?.features?.map((f) => Math.abs(f.importance)) ?? [1]),
  );
  const muted = theme === "dark" ? "#9dadbf" : "#526676";
  const base: EChartsOption = {
    animation: false,
    color: [chartPalette(theme)[1], chartPalette(theme)[0]],
    grid: { left: 55, right: 25, top: 25, bottom: 45 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", axisLabel: { color: muted, fontSize: 10 } },
    yAxis: {
      type: "value",
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: {
        lineStyle: { color: theme === "dark" ? "#253747" : "#d9e2e8" },
      },
    },
  };
  const residual = metrics?.residual_distribution as
    { counts: number[]; bin_edges: number[] } | undefined;
  const scatter = metrics?.actual_vs_predicted as
    { actual: number; predicted: number }[] | undefined;
  return (
    <>
      <PageTitle
        title="Models, with the evidence."
        description="Real training. Honest backtesting. Inspect the engineering behind the outlook."
      >
        {query.data?.models.length ? (
          <select
            aria-label="Model version"
            value={model?.version ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {query.data.models.map((m) => (
              <option key={m.version} value={m.version}>
                {m.model_name} · {m.version}
              </option>
            ))}
          </select>
        ) : null}
      </PageTitle>
      {query.isPending || query.error || !model ? (
        <Panel title="Model registry">
          <QueryState
            loading={query.isPending}
            error={query.error}
            empty={!model}
            label="No trained models registered"
            retry={() => query.refetch()}
          />
        </Panel>
      ) : (
        <>
          <Panel
            title="Model leaderboard"
            subtitle="Chronological validation and held-out test · concentration errors in µg/m³"
            action={
              model.active ? (
                <span className="pill accent">Active · {model.model_name}</span>
              ) : undefined
            }
          >
            <div className="metric-strip">
              <div className="metric">
                <small>TEST MAE</small>
                <strong>{formatValue(metrics?.mae, 2)}</strong>
                <span>Mean absolute error · µg/m³</span>
              </div>
              <div className="metric">
                <small>TEST RMSE</small>
                <strong>{formatValue(metrics?.rmse, 2)}</strong>
                <span>Root mean squared error · µg/m³</span>
              </div>
              <div className="metric">
                <small>TEST SAMPLES</small>
                <strong>{formatValue(metrics?.samples, 0)}</strong>
                <span>Predicted target values</span>
              </div>
              <div className="metric">
                <small>TRAINED</small>
                <strong style={{ fontSize: 18 }}>
                  {localTime(model.training_date, city.timezone, true)}
                </strong>
                <span>{model.version}</span>
              </div>
            </div>
            <DataTable
              headers={[
                "Model",
                "Type",
                "Validation MAE",
                "Test MAE",
                "Test RMSE",
                "Test R²",
              ]}
              rows={leaderboard.map((row) => [
                row.model_name,
                row.trained ? "Trained estimator" : "Baseline",
                formatValue(row.validation?.mae, 2),
                formatValue(row.test?.mae, 2),
                formatValue(row.test?.rmse, 2),
                formatValue(row.test?.r2, 3),
              ])}
            />
          </Panel>
          <div className="split-grid">
            <Panel
              title="Error by forecast horizon"
              subtitle="Test MAE · each lead hour evaluated independently"
            >
              {horizon.length ? (
                <EChart
                  style={{ height: 290 }}
                  option={{
                    ...base,
                    xAxis: {
                      ...base.xAxis,
                      type: "category",
                      data: horizon.map(([h]) => `+${h}h`),
                    },
                    series: [
                      {
                        name: "MAE · µg/m³",
                        type: "line",
                        showSymbol: false,
                        data: horizon.map(([, m]) => m.mae),
                      },
                    ],
                  }}
                />
              ) : (
                <QueryState empty />
              )}
            </Panel>
            <Panel
              title="Global feature importance"
              subtitle={`${model.version} · ${importance?.method ?? "Explanation availability"}`}
            >
              {!importance?.features?.length ? (
                <QueryState
                  empty
                  label="Feature importance not recorded for this model version"
                />
              ) : (
                <>
                  <div className="feature-bars">
                    {importance.features.slice(0, 12).map((feature) => (
                      <div className="feature-row" key={feature.feature}>
                        <div>
                          <span>{feature.feature.replaceAll("_", " ")}</span>
                          <span>{formatValue(feature.importance, 3)}</span>
                        </div>
                        <div className="feature-track">
                          <span
                            style={{
                              width: `${max ? (100 * Math.abs(feature.importance)) / max : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Notice>
                    {importance.description} These are global predictive
                    associations, not local causal explanations.
                  </Notice>
                </>
              )}
            </Panel>
          </div>
          <div className="split-grid">
            <Panel
              title="Residual distribution"
              subtitle="Prediction minus actual source estimate · held-out test"
            >
              {residual?.counts.length ? (
                <EChart
                  style={{ height: 280 }}
                  option={{
                    ...base,
                    xAxis: {
                      ...base.xAxis,
                      data: residual.counts.map(
                        (_, i) => `${formatValue(residual.bin_edges[i], 0)}`,
                      ),
                    },
                    series: [
                      {
                        name: "Test residual count",
                        type: "bar",
                        data: residual.counts,
                      },
                    ],
                  }}
                />
              ) : (
                <QueryState empty label="Residual diagnostics not recorded" />
              )}
            </Panel>
            <Panel
              title="Actual vs predicted"
              subtitle="Recorded sample of held-out test targets"
            >
              {scatter?.length ? (
                <EChart
                  style={{ height: 280 }}
                  option={{
                    ...base,
                    tooltip: { trigger: "item" },
                    xAxis: {
                      type: "value",
                      name: "Actual · µg/m³",
                      axisLabel: { color: muted },
                    },
                    yAxis: { ...base.yAxis, name: "Predicted" },
                    series: [
                      {
                        name: "Held-out predictions",
                        type: "scatter",
                        symbolSize: 4,
                        data: scatter.map((s) => [s.actual, s.predicted]),
                      },
                    ],
                  }}
                />
              ) : (
                <QueryState empty />
              )}
            </Panel>
          </div>
          <Panel
            title="City-level evaluation"
            subtitle="Known-city test performance; a pooled score can hide local weaknesses"
          >
            <DataTable
              headers={[
                "City",
                "MAE · µg/m³",
                "RMSE · µg/m³",
                "R²",
                "Bias",
                "Samples",
              ]}
              rows={byCity.map(([name, m]) => [
                name,
                formatValue(m.mae, 2),
                formatValue(m.rmse, 2),
                formatValue(m.r2, 3),
                formatValue(m.bias, 2),
                formatValue(m.samples, 0),
              ])}
            />
          </Panel>
          <Panel
            title="Training provenance"
            subtitle="Reproducibility and limits"
          >
            <div className="metadata-list">
              {[
                "validation_strategy",
                "strategy",
                "selection",
                "supported_city_ids",
                "heldout_city_id",
              ].map((key) => (
                <div className="metadata-row" key={key}>
                  <span>{key.replaceAll("_", " ")}</span>
                  <span>
                    {typeof model.metadata[key] === "string"
                      ? String(model.metadata[key])
                      : Array.isArray(model.metadata[key])
                        ? (model.metadata[key] as string[]).join(", ")
                        : "Not recorded"}
                  </span>
                </div>
              ))}
            </div>
            <div className="metadata-list">
              {Object.entries(
                (model.metadata.training_configuration ?? {}) as Record<
                  string,
                  unknown
                >,
              )
                .filter(([key]) =>
                  [
                    "training_rows",
                    "validation_rows",
                    "test_rows",
                    "origin_stride_hours",
                    "train_origin_start",
                    "train_target_end",
                    "validation_origin_start",
                    "validation_target_end",
                    "test_origin_start",
                    "test_target_end",
                  ].includes(key),
                )
                .map(([key, value]) => (
                  <div className="metadata-row" key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
            </div>
            {((model.metadata.warnings ?? []) as string[]).map((w) => (
              <Notice key={w}>{w}</Notice>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
