"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Cloud,
  Clock3,
  Layers3,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { api, localTime } from "@/lib/api";
import { PageTitle, Panel } from "@/components/environment-panels";
import { useEnvironment } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/query-state";
type Status = {
  backend: string;
  database: string;
  checked_at: string;
  data_sources: Record<string, unknown>;
  last_successful_ingestion: string | null;
  last_forecast_generation: string | null;
  active_model_version: string | null;
  scheduler: { running: boolean; jobs: { id: string; next_run: string }[] };
};
export function SystemStatus() {
  const { city } = useEnvironment();
  const query = useQuery({
    queryKey: ["system-status"],
    queryFn: ({ signal }) => api<Status>("system/status", signal),
    refetchInterval: 60000,
  });
  const status = query.data;
  const items = status
    ? [
        {
          name: "Backend API",
          value: status.backend,
          Icon: Activity,
          good: status.backend === "operational",
        },
        {
          name: "Database",
          value: status.database,
          Icon: Database,
          good: status.database === "connected",
        },
        {
          name: "Data-source availability",
          value: Object.entries(status.data_sources)
            .map(
              ([key, value]) =>
                `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
            )
            .join(" · "),
          Icon: Cloud,
        },
        {
          name: "Last successful ingestion",
          value: localTime(
            status.last_successful_ingestion,
            city.timezone,
            true,
          ),
          Icon: Clock3,
        },
        {
          name: "Last forecast generation",
          value: localTime(
            status.last_forecast_generation,
            city.timezone,
            true,
          ),
          Icon: Clock3,
        },
        {
          name: "Active model",
          value: status.active_model_version ?? "No active trained model",
          Icon: Layers3,
        },
        {
          name: "Scheduler",
          value: status.scheduler.running ? "Running" : "Stopped",
          Icon: CalendarClock,
          good: status.scheduler.running,
        },
        {
          name: "Next scheduled job",
          value:
            status.scheduler.jobs
              .map(
                (job) =>
                  `${job.id} · ${localTime(job.next_run, city.timezone, true)}`,
              )
              .join(" · ") || "No jobs scheduled",
          Icon: CalendarClock,
        },
      ]
    : [];
  return (
    <>
      <PageTitle
        title="A transparent operation."
        description="Live service health, collection activity and model availability."
      >
        <Button
          variant="outline"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} className={query.isFetching ? "spin" : ""} />
          Refresh status
        </Button>
      </PageTitle>
      <Panel
        title="System status"
        subtitle="Reported by the backend · automatically checked every minute"
        action={
          status ? (
            <span className="pill">
              Checked {localTime(status.checked_at, city.timezone, true)}
            </span>
          ) : undefined
        }
      >
        {query.isPending || query.error ? (
          <QueryState
            loading={query.isPending}
            error={query.error}
            retry={() => query.refetch()}
          />
        ) : (
          <div className="status-grid">
            {items.map((item) => (
              <div key={item.name} className="status-item">
                <item.Icon size={20} />
                <div>
                  <h3>{item.name}</h3>
                  <p
                    className={`status-value ${item.good === true ? "is-good" : item.good === false ? "is-bad" : ""}`}
                  >
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="panel-footnote">
          Unknown or unchecked source availability is reported as such. A
          reachable backend does not imply that upstream data sources are
          available.
        </div>
      </Panel>
    </>
  );
}
