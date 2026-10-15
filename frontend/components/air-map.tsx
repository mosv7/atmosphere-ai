"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MapType, Marker as MarkerType } from "maplibre-gl";
import { Globe2, MapPin } from "lucide-react";
import { useCities, useEnvironment } from "./providers";
import { api, formatValue, localTime, type Pollutant } from "@/lib/api";
import { mapRequest, type MapSnapshot } from "@/lib/map-data";
import { useQuery } from "@tanstack/react-query";
export function AirMap({
  large = false,
  pollutant = "pm25",
  hoursAgo = 0,
}: {
  large?: boolean;
  pollutant?: Pollutant;
  hoursAgo?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapType | null>(null);
  const markers = useRef<MarkerType[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const { city, selectCity, theme } = useEnvironment();
  const cities = useCities();
  const mappedCities = (cities.data?.cities ?? []).filter(
    (entry) => !entry.id.startsWith("geo-") || entry.id === city.id,
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const conditions = useQuery({
    queryKey: [
      "map-conditions",
      city.id,
      hoursAgo,
      cities.data?.cities.map((c) => c.id).join(","),
    ],
    queryFn: ({ signal }) =>
      api<MapSnapshot>(mapRequest(city, mappedCities, hoursAgo), signal),
    enabled: !!cities.data?.cities.length,
  });
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then((lib) => {
      if (cancelled || !container.current) return;
      try {
        lib.setWorkerUrl("/maplibre-gl-worker.mjs");
        const instance = new lib.Map({
          container: container.current,
          style:
            theme === "dark"
              ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          center: [25, 25],
          zoom: 1.2,
          minZoom: 0.5,
          maxZoom: 12,
          attributionControl: { compact: true },
        });
        map.current = instance;
        resizeObserver.current = new ResizeObserver(() => instance.resize());
        resizeObserver.current.observe(container.current!);
        instance.addControl(
          new lib.NavigationControl({ showCompass: false }),
          "bottom-left",
        );
        instance.on("load", () => {
          setReady(true);
          setError("");
        });
        instance.on("error", () =>
          setError(
            "Some map tiles could not load. City selection remains available.",
          ),
        );
      } catch {
        setError(
          "Interactive map unavailable in this browser. Select a city below.",
        );
      }
    });
    return () => {
      cancelled = true;
      resizeObserver.current?.disconnect();
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, [theme]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    import("maplibre-gl").then((lib) => {
      if (disposed || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      const list = [
        ...(cities.data?.cities ?? []).filter(
          (c) => c.id !== city.id && !c.id.startsWith("geo-"),
        ),
        city,
      ];
      markers.current = list.map((item) => {
        const snapshot = conditions.data?.cities.find(
          (c) => c.city.id === item.id,
        );
        const reading = snapshot?.observation?.[pollutant];
        const button = document.createElement("button");
        button.className = `map-marker ${item.id === city.id ? "selected" : ""}`;
        if (reading == null)
          button.style.setProperty("--marker-color", "#9dadbf");
        if (reading != null)
          button.style.setProperty(
            "--marker-color",
            reading > 50 ? "#eda573" : reading > 25 ? "#e4ce78" : "#52e0ac",
          );
        button.setAttribute(
          "aria-label",
          `Select ${item.name}${reading != null ? `, ${formatValue(reading)} µg/m³` : ""}`,
        );
        button.title =
          reading != null
            ? `${item.name}: ${formatValue(reading)} µg/m³ · Source time ${localTime(snapshot?.observation?.timestamp, item.timezone, true)} · ${item.timezone}`
            : `${item.name}: ${snapshot?.error ?? "No available source value for selected time"}`;
        const dot = document.createElement("span");
        dot.className = "marker-dot";
        const label = document.createElement("span");
        label.className = "marker-name";
        label.textContent = item.name;
        button.append(dot, label);
        button.addEventListener("click", () => selectCity(item));
        return new lib.Marker({ element: button })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map.current!);
      });
      map.current.flyTo({
        center: [city.longitude, city.latitude],
        zoom: large ? 3 : 1.5,
        duration: 800,
        essential: false,
      });
    });
    return () => {
      disposed = true;
    };
  }, [ready, cities.data, city, selectCity, large, pollutant, conditions.data]);
  return (
    <div className={`air-map ${large ? "map-large" : ""}`}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive city air quality map"
      />
      {!ready && !error && (
        <div className="map-loading">
          <Globe2 size={48} strokeWidth={0.7} />
          <span>Connecting to the world…</span>
        </div>
      )}
      <div className="map-caption">
        <Globe2 size={13} />{" "}
        {hoursAgo > 0
          ? `Historical cutoff: ${localTime(conditions.data?.target_timestamp, city.timezone, true)} · ${city.timezone}`
          : "Latest source estimates · monitoring cities + selected location"}
      </div>
      {(conditions.isFetching || conditions.error) && (
        <div className="map-data-feedback" role="status">
          {conditions.error
            ? `Map values unavailable: ${conditions.error.message}`
            : "Loading source values for selected time…"}
        </div>
      )}
      {error && (
        <div className="map-error">
          {error}
          <select
            aria-label="Map fallback city selection"
            value={city.id}
            onChange={(e) => {
              const next = cities.data?.cities.find(
                (c) => c.id === e.target.value,
              );
              if (next) selectCity(next);
            }}
          >
            {(cities.data?.cities ?? [city]).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="map-location">
        <MapPin size={14} />
        {city.name}
        <span>
          {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
        </span>
      </div>
    </div>
  );
}
