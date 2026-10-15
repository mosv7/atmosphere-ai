"use client";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { useEnvironment } from "./providers";
import { localTime } from "@/lib/api";
import { chartPalette, chartColor } from "@/lib/chart-theme";
const EChart = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="chart-loading skeleton" />,
});
export type ChartSeries = {
  name: string;
  data: [string, number | null][];
  color?: string;
  dashed?: boolean;
};
export function DataChart({
  series,
  height = 280,
  unit = "µg/m³",
  boundary,
}: {
  series: ChartSeries[];
  height?: number;
  unit?: string;
  boundary?: string;
}) {
  const { theme, city } = useEnvironment();
  const muted = theme === "dark" ? "#9dadbf" : "#526676";
  const border = theme === "dark" ? "#253747" : "#d9e2e8";
  const options: EChartsOption = {
    animation: false,
    color: chartPalette(theme),
    grid: { left: 55, right: 25, top: 35, bottom: 50 },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      backgroundColor: theme === "dark" ? "#101b27" : "#fff",
      borderColor: border,
      textStyle: { color: muted },
      valueFormatter: (value) =>
        `${typeof value === "number" ? value.toFixed(2) : value} ${unit}`,
      formatter: (params) => {
        const entries = (Array.isArray(params) ? params : [params]) as {
          value: unknown;
          seriesName?: string;
        }[];
        const timestamp = Array.isArray(entries[0]?.value)
          ? String(entries[0].value[0])
          : "";
        return (
          `${localTime(timestamp, city.timezone, true)} · ${city.timezone}\n` +
          entries
            .map((entry) => {
              const value = Array.isArray(entry.value) ? entry.value[1] : null;
              return `${entry.seriesName ?? "Concentration"}: ${typeof value === "number" ? value.toFixed(2) : "—"} ${unit}`;
            })
            .join("\n")
        );
      },
    },
    legend: {
      top: 0,
      textStyle: { color: muted, fontSize: 11 },
      icon: "roundRect",
      itemWidth: 14,
      itemHeight: 3,
    },
    xAxis: {
      type: "time",
      splitNumber: 4,
      axisLine: { lineStyle: { color: border } },
      axisLabel: {
        color: muted,
        fontSize: 10,
        formatter: (value: number) =>
          localTime(new Date(value).toISOString(), city.timezone, true),
        hideOverlap: true,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: unit,
      nameTextStyle: { color: muted, fontSize: 10 },
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: border, type: "dashed" } },
    },
    series: series.map((item, index) => ({
      name: item.name,
      type: "line",
      data: item.data,
      showSymbol: false,
      connectNulls: false,
      lineStyle: {
        width: 2,
        color: chartColor(item.color, theme),
        type: item.dashed ? "dashed" : "solid",
      },
      itemStyle: { color: chartColor(item.color, theme) },
      areaStyle: index === 0 ? { opacity: 0.055 } : undefined,
      ...(boundary && index === 0
        ? {
            markLine: {
              silent: true,
              symbol: "none",
              label: { formatter: "Forecast begins", color: muted },
              lineStyle: { color: muted, type: "dashed" },
              data: [{ xAxis: boundary }],
            },
          }
        : {}),
    })),
    aria: { enabled: true, decal: { show: false } },
  };
  return (
    <div
      className="data-chart"
      role="img"
      aria-label={`Time series chart: ${series.map((s) => s.name).join(", ")} in ${unit}`}
    >
      <EChart
        option={options}
        style={{ height, width: "100%" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
