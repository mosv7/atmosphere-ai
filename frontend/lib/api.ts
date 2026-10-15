import { z } from "zod";
export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  administrative_region: z.string().nullable().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
});
export type City = z.infer<typeof citySchema>;
export type Pollutant = "pm25" | "pm10" | "no2" | "o3" | "so2" | "co";
export const pollutants: { key: Pollutant; label: string }[] = [
  { key: "pm25", label: "PM2.5" },
  { key: "pm10", label: "PM10" },
  { key: "no2", label: "NO₂" },
  { key: "o3", label: "O₃" },
  { key: "so2", label: "SO₂" },
  { key: "co", label: "CO" },
];
export type Observation = { timestamp: string } & Record<
  Pollutant,
  number | null
>;
export type Current = {
  city: City;
  observation: Observation;
  weather: Record<string, unknown> | null;
  source: string;
  source_type: string;
  retrieved_at: string;
  age_hours: number;
  warnings: string[];
};
export type History = {
  city: City;
  records: Observation[];
  source: string;
  source_type: string;
  units: string;
  warnings: string[];
};
export type Forecast = {
  city: City;
  issued_at: string;
  observation_timestamp: string;
  model_version: string;
  model_family: string;
  units: string;
  source: string;
  coverage: unknown;
  warnings: string[];
  uncertainty: unknown;
  values: {
    timestamp: string;
    horizon_hours: number;
    predicted_pm25: number;
    lower_bound: number | null;
    upper_bound: number | null;
  }[];
};
export type Model = {
  version: string;
  model_name: string;
  training_date: string;
  metrics: Record<string, unknown>;
  metadata: Record<string, unknown>;
  active: boolean;
};
export type Coverage = {
  cities: {
    city: City;
    records: number;
    start: string | null;
    end: string | null;
    missing_pm25: number;
    latest_ingestion: string | null;
  }[];
  source: string;
};
export async function api<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Request failed (${response.status})` }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : JSON.stringify(error.detail),
    );
  }
  return response.json();
}
export const formatValue = (value: unknown, digits = 1) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en", { maximumFractionDigits: digits })
    : "—";
export function localTime(
  value: string | null | undefined,
  zone = "UTC",
  full = false,
) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: full ? "2-digit" : undefined,
    month: full ? "short" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
export const defaultCity: City = {
  id: "cairo",
  name: "Cairo",
  country: "Egypt",
  administrative_region: "Cairo",
  latitude: 30.0444,
  longitude: 31.2357,
  timezone: "Africa/Cairo",
};
