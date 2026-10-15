"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Clock3, MapPin, Wind } from "lucide-react";
import {
  api,
  formatValue,
  localTime,
  pollutants,
  type Current,
  type Forecast,
  type History,
  type Pollutant,
} from "@/lib/api";
import { useEnvironment } from "./providers";
import { QueryState, Notice } from "./query-state";
import { DataChart } from "./data-chart";
export function useCurrent() {
  const { city } = useEnvironment();
  return useQuery({
    queryKey: ["current", city.id],
    queryFn: ({ signal }) =>
      api<Current>(
        `air-quality/current?city_id=${encodeURIComponent(city.id)}`,
        signal,
      ),
  });
}
export function useHistory(days = 7) {
  const { city } = useEnvironment();
  return useQuery({
    queryKey: ["history", city.id, days],
    queryFn: ({ signal }) =>
      api<History>(
        `air-quality/history?city_id=${encodeURIComponent(city.id)}&days=${days}`,
        signal,
      ),
  });
}
export function useForecast() {
  const { city } = useEnvironment();
  return useQuery({
    queryKey: ["forecast", city.id],
    queryFn: ({ signal }) =>
      api<Forecast>(
        `forecast/72h?city_id=${encodeURIComponent(city.id)}`,
        signal,
      ),
    retry: false,
  });
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-controls">{children}</div>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function CityInspector() {
  const { city } = useEnvironment();
  const query = useCurrent();
  const data = query.data;
  return (
    <section className="panel city-inspector">
      <div className="city-inspector-heading">
        <span className="city-country">
          <MapPin size={13} />
          {city.country}
        </span>
        <h2>{city.name}</h2>
        <p>
          {city.latitude.toFixed(4)}° N, {city.longitude.toFixed(4)}° E
        </p>
      </div>
      {query.isPending || query.error ? (
        <QueryState
          loading={query.isPending}
          error={query.error}
          retry={() => query.refetch()}
        />
      ) : (
        <>
          <div className="concentration">
            <div className="reading-label">
              <span>PM2.5</span>
              <span>µg/m³</span>
            </div>
            <div className="big-number">
              {formatValue(data?.observation?.pm25)}
            </div>
            <span className="estimate-label">
              <span /> CAMS model estimate
            </span>
          </div>
          <div className="pollutant-list">
            {pollutants.slice(1).map((item) => (
              <div key={item.key}>
                <span>{item.label}</span>
                <small>µg/m³</small>
                <strong>{formatValue(data?.observation?.[item.key])}</strong>
              </div>
            ))}
          </div>
          <div className="freshness">
            <Clock3 size={13} />
            <span>
              Source time{" "}
              {localTime(data?.observation?.timestamp, city.timezone, true)}
              <br />
              <small>
                Retrieved {localTime(data?.retrieved_at, city.timezone, true)}
              </small>
            </span>
          </div>
          {data?.warnings?.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
        </>
      )}
      <Link className="text-link inspector-link" href="/city">
        Explore city intelligence <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}
export function ForecastPreview() {
  const { city } = useEnvironment();
  const query = useForecast();
  return (
    <Panel
      title="72-hour outlook"
      subtitle={`Modeled PM2.5 forecast for ${city.name}`}
      action={
        <Link className="text-link" href="/forecast">
          Open studio <ArrowUpRight size={15} />
        </Link>
      }
    >
      {query.isPending || query.error || !query.data?.values.length ? (
        <QueryState
          loading={query.isPending}
          error={query.error}
          empty={!query.data?.values.length}
          label="Forecast available after model training"
          retry={() => query.refetch()}
        />
      ) : (
        <>
          <DataChart
            height={235}
            series={[
              {
                name: "ML forecast · PM2.5",
                data: query.data.values.map((v) => [
                  v.timestamp,
                  v.predicted_pm25,
                ]),
                color: "#7ccee8",
                dashed: true,
              },
            ]}
          />
          <div className="panel-footnote">
            {query.data.model_family} · {query.data.model_version} · Issued{" "}
            {localTime(query.data.issued_at, city.timezone, true)}
          </div>
        </>
      )}
    </Panel>
  );
}
export function HistoryPanel({
  days = 7,
  pollutant = "pm25",
}: {
  days?: number;
  pollutant?: Pollutant;
}) {
  const query = useHistory(days);
  const { city } = useEnvironment();
  return (
    <Panel
      title="The recent picture"
      subtitle={`Stored ${pollutants.find((p) => p.key === pollutant)?.label} source estimates · ${city.name} · ${days} days`}
      action={<Wind size={19} className="muted" />}
    >
      {query.isPending || query.error || !query.data?.records.length ? (
        <QueryState
          loading={query.isPending}
          error={query.error}
          empty={!query.data?.records.length}
          retry={() => query.refetch()}
        />
      ) : (
        <DataChart
          series={[
            {
              name: "Historical source estimates",
              data: query.data.records.map((row) => [
                row.timestamp,
                row[pollutant],
              ]),
            },
          ]}
        />
      )}
    </Panel>
  );
}
