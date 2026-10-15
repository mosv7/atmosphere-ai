import { AlertCircle, Database, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
export function QueryState({
  loading,
  error,
  empty,
  retry,
  label = "No data available yet",
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  retry?: () => void;
  label?: string;
}) {
  if (loading)
    return (
      <div
        className="query-state skeleton-state"
        role="status"
        aria-label="Loading environmental data"
      >
        <span className="skeleton wide" />
        <span className="skeleton" />
        <span className="skeleton narrow" />
        <span className="sr-only">Loading environmental data</span>
      </div>
    );
  if (error)
    return (
      <div className="query-state" role="alert">
        <AlertCircle size={24} />
        <strong>Data temporarily unavailable</strong>
        <p>{error.message}</p>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw size={14} /> Try again
          </Button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="query-state">
        <Database size={26} />
        <strong>{label}</strong>
        <p>Collected source data will appear here when available.</p>
      </div>
    );
  return null;
}
export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="notice">{children}</div>;
}
