"use client";
import { QueryState } from "@/components/query-state";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <QueryState error={error} retry={reset} />;
}
