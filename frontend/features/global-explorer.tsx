"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  PageTitle,
  Panel,
  CityInspector,
} from "@/components/environment-panels";
import { pollutants, type Pollutant } from "@/lib/api";
import { CitySearch } from "@/components/city-search";
const AirMap = dynamic(
  () => import("@/components/air-map").then((m) => m.AirMap),
  { ssr: false },
);
export function GlobalExplorer() {
  const [pollutant, setPollutant] = useState<Pollutant>("pm25");
  const [hoursAgo, setHoursAgo] = useState(0);
  return (
    <>
      <PageTitle
        title="A world of perspective."
        description="Explore actual city locations. Select a marker to inspect its latest source estimate."
      />
      <div className="explorer-controls">
        <CitySearch />
        <select
          aria-label="Explorer pollutant"
          value={pollutant}
          onChange={(e) => setPollutant(e.target.value as Pollutant)}
        >
          {pollutants.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Map time"
          value={hoursAgo}
          onChange={(event) => setHoursAgo(Number(event.target.value))}
        >
          <option value={0}>Latest available</option>
          <option value={24}>24 hours ago</option>
          <option value={168}>7 days ago</option>
        </select>
        <span className="pill">
          {hoursAgo === 0
            ? "Latest available source time"
            : `${hoursAgo === 24 ? "24 hours" : "7 days"} ago · stored estimates`}
        </span>
      </div>
      <Panel
        title="Global explorer"
        subtitle="Drag to pan · scroll to zoom · select a city"
      >
        <div className="explorer-layout">
          <AirMap large pollutant={pollutant} hoursAgo={hoursAgo} />
          <CityInspector />
        </div>
        <div className="panel-footnote">
          Marker colors show source concentration where available: ≤25, 25–50,
          &gt;50 µg/m³; these are display bins, not health categories. Gray: no
          retrieved value.{" "}
          {hoursAgo > 0
            ? "Historical colors use the latest stored record at or before the selected cutoff; some cities may have no record. These retrospective archive estimates do not establish what was available as issued at that time. The inspector shows latest conditions."
            : "Markers use latest available source values."}{" "}
          No continuous heatmap is claimed.
        </div>
      </Panel>
    </>
  );
}
