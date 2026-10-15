import React, { useEffect } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Providers, useEnvironment } from "@/components/providers";
import { ForecastStudio } from "@/features/forecast-studio";
import { ModelLab } from "@/features/model-lab";
import { defaultCity, type Forecast, type Model } from "@/lib/api";
vi.mock("@/components/data-chart", () => ({
  DataChart: () => <div>Scientific chart</div>,
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div>Evaluation chart</div>,
}));
const london = {
  ...defaultCity,
  id: "london",
  name: "London",
  timezone: "Europe/London",
};
function makeForecast(city = defaultCity, value = 10): Forecast {
  return {
    city,
    issued_at: "2026-10-15T00:00:00Z",
    observation_timestamp: "2026-10-15T00:00:00Z",
    model_version: "tested",
    model_family: "Ridge",
    units: "µg/m³",
    source: "CAMS",
    coverage: "Evaluated city",
    warnings: [],
    uncertainty: null,
    values: [
      {
        timestamp: "2026-10-15T01:00:00Z",
        horizon_hours: 1,
        predicted_pm25: value,
        lower_bound: null,
        upper_bound: null,
      },
    ],
  };
}
function Switcher({ capture }: { capture: (client: QueryClient) => void }) {
  const { selectCity } = useEnvironment();
  const client = useQueryClient();
  useEffect(() => capture(client), [capture, client]);
  return <button onClick={() => selectCity(london)}>Switch to London</button>;
}
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("selection-scoped asynchronous results", () => {
  it("keeps a delayed Cairo refresh out of the London forecast cache after city selection changes", async () => {
    let complete!: (response: unknown) => void;
    const deferred = new Promise((resolve) => {
      complete = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string, options?: RequestInit) => {
        if (options?.method === "POST") return deferred;
        const city = path.includes("city_id=london") ? london : defaultCity;
        return Promise.resolve({
          ok: true,
          json: async () =>
            path.includes("history")
              ? { city, records: [], warnings: [] }
              : makeForecast(city, city.id === "london" ? 20 : 10),
        });
      }),
    );
    const capture = vi.fn();
    render(
      <Providers>
        <Switcher capture={capture} />
        <ForecastStudio />
      </Providers>,
    );
    await screen.findByText("Cairo · forecast");
    await waitFor(() =>
      expect(
        capture.mock.calls[0][0].getQueryData(["forecast", "cairo"]),
      ).toBeDefined(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh forecast" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to London" }));
    await screen.findByText("London · forecast");
    const client = capture.mock.calls[0][0] as QueryClient;
    await waitFor(() =>
      expect(
        client.getQueryData<Forecast>(["forecast", "london"])?.values[0]
          .predicted_pm25,
      ).toBe(20),
    );
    expect(
      screen.getByRole("button", { name: "Generating Cairo…" }),
    ).toBeInTheDocument();
    await act(async () => {
      complete({ ok: true, json: async () => makeForecast(defaultCity, 99) });
      await deferred;
    });
    await waitFor(() =>
      expect(
        client.getQueryData<Forecast>(["forecast", "cairo"])?.values[0]
          .predicted_pm25,
      ).toBe(99),
    );
    expect(client.getQueryData<Forecast>(["forecast", "london"])?.city.id).toBe(
      "london",
    );
    expect(
      client.getQueryData<Forecast>(["forecast", "london"])?.values[0]
        .predicted_pm25,
    ).toBe(20);
  });
  it("shows only feature importance recorded for the selected model version", async () => {
    const model = (version: string, feature?: string): Model => ({
      version,
      model_name: "Ridge",
      training_date: "2026-10-15T00:00:00Z",
      active: version === "active",
      metrics: {},
      metadata: feature
        ? {
            feature_importance: {
              features: [{ feature, importance: 1 }],
              method: "Permutation importance",
              description: `${version} evaluation`,
            },
          }
        : {},
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            model("active", "active_only_feature"),
            model("historical", "historical_only_feature"),
            model("no-importance"),
          ],
        }),
      });
    vi.stubGlobal("fetch", fetcher);
    render(
      <Providers>
        <ModelLab />
      </Providers>,
    );
    await screen.findByText("active only feature");
    fireEvent.change(screen.getByRole("combobox", { name: "Model version" }), {
      target: { value: "historical" },
    });
    expect(screen.getByText("historical only feature")).toBeInTheDocument();
    expect(screen.queryByText("active only feature")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Model version" }), {
      target: { value: "no-importance" },
    });
    expect(
      screen.getByText(
        "Feature importance not recorded for this model version",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("historical only feature"),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.every(([path]) => path === "/api/models")).toBe(
      true,
    );
  });
});
