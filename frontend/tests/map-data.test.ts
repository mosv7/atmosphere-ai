import { describe, it, expect } from "vitest";
import { mapRequest } from "@/lib/map-data";
import { defaultCity } from "@/lib/api";
describe("map source time requests", () => {
  it("requests stored historical cutoff values without geocoding candidate clutter", () => {
    const cities = [
      { ...defaultCity, id: "geo-111", name: "Other Cairo" },
      { ...defaultCity, id: "london", name: "London" },
    ];
    expect(mapRequest(defaultCity, cities, 24)).toBe(
      "analytics/map-snapshot?city_ids=cairo,london&hours_ago=24",
    );
    expect(mapRequest(defaultCity, cities, 168)).toContain("hours_ago=168");
  });
  it("preserves a selected worldwide city and caps source requests at five cities", () => {
    const city = { ...defaultCity, id: "geo-111", name: "Selected place" };
    const cities = Array.from({ length: 8 }, (_, i) => ({
      ...defaultCity,
      id: `monitor-${i}`,
    }));
    const path = mapRequest(city, cities, 0);
    expect(path).toContain(
      "city_ids=geo-111,monitor-0,monitor-1,monitor-2,monitor-3",
    );
    expect(path).not.toContain("monitor-4");
    expect(path).not.toContain("hours_ago");
  });
});
