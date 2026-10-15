import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Providers } from "@/components/providers";
import { CitySearch } from "@/components/city-search";
import { QueryState } from "@/components/query-state";
import { api, defaultCity, localTime, formatValue } from "@/lib/api";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("source data formatting", () => {
  it("renders source times in city timezones and preserves missing values", () => {
    expect(localTime("2026-01-01T00:00:00Z", "Asia/Tokyo")).toBe("09:00");
    expect(formatValue(null)).toBe("—");
    expect(formatValue(0)).toBe("0");
  });
  it("surfaces actionable API errors instead of substituting data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ detail: "City outside evaluated coverage" }),
        }),
    );
    await expect(api("forecast/72h")).rejects.toThrow(
      "City outside evaluated coverage",
    );
  });
});
describe("resilient async state", () => {
  it("announces loading without fabricated environmental values", () => {
    render(<QueryState loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("µg/m³")).not.toBeInTheDocument();
  });
  it("retries a failed request explicitly", () => {
    const retry = vi.fn();
    render(
      <QueryState error={new Error("Upstream unavailable")} retry={retry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Upstream unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
describe("worldwide city search", () => {
  it("debounces requests, selects with keyboard and restores focus on clear", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ cities: [defaultCity] }),
      });
    vi.stubGlobal("fetch", fetcher);
    const selected = vi.fn();
    render(
      <Providers>
        <CitySearch onSelect={selected} />
      </Providers>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Cai" } });
    expect(fetcher).not.toHaveBeenCalled();
    await screen.findByRole("option");
    expect(fetcher.mock.calls[0][0]).toBe("/api/cities/search?q=Cai");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(selected).toHaveBeenCalledWith(defaultCity);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "Lon" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue("");
  });
  it("does not submit an IME composition and hides stale options", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ cities: [defaultCity] }),
        }),
    );
    const selected = vi.fn();
    render(
      <Providers>
        <CitySearch onSelect={selected} />
      </Providers>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Cairo" } });
    await screen.findByRole("option");
    fireEvent.change(input, { target: { value: "London" } });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(selected).not.toHaveBeenCalled();
  });
  it("supports search failure recovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ detail: "Unavailable" }),
        }),
    );
    render(
      <Providers>
        <CitySearch />
      </Providers>,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Cairo" },
    });
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Retry search" }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
