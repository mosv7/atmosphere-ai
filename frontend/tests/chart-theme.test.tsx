import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Providers, useEnvironment } from "@/components/providers";
import { DataChart } from "@/components/data-chart";
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({
      option,
    }: {
      option: {
        series: {
          name: string;
          data: unknown[];
          lineStyle: { type: string; color?: string };
        }[];
      };
    }) => (
      <div data-testid="chart-adapter">
        {option.series.map((series) => (
          <span key={series.name} data-color={series.lineStyle.color}>
            {series.name}: {series.data.length} points · {series.lineStyle.type}
          </span>
        ))}
      </div>
    ),
}));
function ThemeControl() {
  const { theme, toggleTheme } = useEnvironment();
  return <button onClick={toggleTheme}>{theme}</button>;
}
describe("chart and theme contracts", () => {
  it("renders source and prediction series distinctly without filling missing readings", () => {
    render(
      <Providers>
        <DataChart
          series={[
            {
              name: "Source estimates",
              data: [
                ["2026-10-15T00:00:00Z", null],
                ["2026-10-15T01:00:00Z", 19],
              ],
            },
            {
              name: "ML prediction",
              data: [["2026-10-15T02:00:00Z", 18]],
              dashed: true,
            },
          ]}
        />
      </Providers>,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Time series chart: Source estimates, ML prediction in µg/m³",
    );
    expect(
      screen.getByText("Source estimates: 2 points · solid"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ML prediction: 1 points · dashed"),
    ).toBeInTheDocument();
  });
  it("applies and persists a deliberate light theme", () => {
    localStorage.removeItem("atmosphere-theme");
    render(
      <Providers>
        <ThemeControl />
      </Providers>,
    );
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("atmosphere-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("adapts explicit forecast colors to legible light-theme colors", () => {
    localStorage.removeItem("atmosphere-theme");
    render(
      <Providers>
        <ThemeControl />
        <DataChart
          series={[
            {
              name: "Forecast contrast",
              data: [["2026-10-15T02:00:00Z", 18]],
              color: "#7ccee8",
              dashed: true,
            },
          ]}
        />
      </Providers>,
    );
    expect(
      screen.getByText("Forecast contrast: 1 points · dashed"),
    ).toHaveAttribute("data-color", "#7ccee8");
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(
      screen.getByText("Forecast contrast: 1 points · dashed"),
    ).toHaveAttribute("data-color", "#08779a");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(
      screen.getByText("Forecast contrast: 1 points · dashed"),
    ).toHaveAttribute("data-color", "#7ccee8");
  });
});
