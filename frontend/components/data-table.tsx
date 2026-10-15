"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
export function DataTable({
  headers,
  rows,
  pageSize = 24,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const max = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const safe = Math.min(page, max);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(safe * pageSize, (safe + 1) * pageSize)
              .map((row, index) => (
                <tr key={index}>
                  {row.map((cell, col) => (
                    <td key={col}>{cell}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty-inline">No records match these filters.</div>
        )}
      </div>
      <div className="table-pagination">
        <span>
          {rows.length
            ? `${safe * pageSize + 1}–${Math.min(rows.length, (safe + 1) * pageSize)} of ${rows.length} records`
            : "0 records"}
        </span>
        <div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={safe === 0}
            onClick={() => setPage(safe - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={safe === max}
            onClick={() => setPage(safe + 1)}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </>
  );
}
