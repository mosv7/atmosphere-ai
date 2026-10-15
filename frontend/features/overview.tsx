"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  PageTitle,
  Panel,
  CityInspector,
  ForecastPreview,
  HistoryPanel,
} from "@/components/environment-panels";
import { pollutants, type Pollutant } from "@/lib/api";
const AirMap = dynamic(
  () => import("@/components/air-map").then((m) => m.AirMap),
  { ssr: false, loading: () => <div className="air-map skeleton" /> },
);
export function Overview() {
  const [pollutant, setPollutant] = useState<Pollutant>("pm25");
  return (
    <>
      <PageTitle
        title="A clearer view of the air."
        description="Environmental intelligence, grounded in real data."
      />
      <div className="overview-grid">
        <Panel
          className="map-panel"
          title="Global perspective"
          subtitle="Explore the air around you."
          action={
            <select
              aria-label="Map pollutant"
              value={pollutant}
              onChange={(e) => setPollutant(e.target.value as Pollutant)}
            >
              {pollutants.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          }
        >
          <AirMap pollutant={pollutant} />
          <div className="map-panel-footer">
            <span>
              <i className="legend-dot" /> Source concentration where available
              · µg/m³
            </span>
            <Link href="/explorer" className="text-link">
              Explore map <ArrowUpRight size={13} />
            </Link>
          </div>
        </Panel>
        <CityInspector />
      </div>
      <ForecastPreview />
      <HistoryPanel days={7} />
    </>
  );
}
