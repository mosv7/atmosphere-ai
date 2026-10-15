import type { City, Observation } from "./api";
export type MapSnapshot = {
  cities: {
    city: City;
    observation?: Observation;
    error?: string;
    warnings?: string[];
  }[];
  target_timestamp?: string;
};
export function mapRequest(city: City, cities: City[], hoursAgo: number) {
  const ids = [
    city,
    ...cities.filter(
      (entry) => entry.id !== city.id && !entry.id.startsWith("geo-"),
    ),
  ]
    .slice(0, 5)
    .map((entry) => encodeURIComponent(entry.id))
    .join(",");
  return hoursAgo > 0
    ? `analytics/map-snapshot?city_ids=${ids}&hours_ago=${hoursAgo}`
    : `analytics/city-comparison?city_ids=${ids}`;
}
