"use client";

import { useState } from "react";

export type ExportColumn<T> = {
  /** Column heading in the sheet. */
  label: string;
  /** The cell value. Return a number to keep it summable in Excel. */
  value: (row: T) => string | number | boolean | null | undefined;
};

/**
 * "Export Excel" for an admin list. Give it the rows the list is showing and
 * the columns to write; it posts them to /api/export/xlsx and downloads a real
 * .xlsx file — so the export always matches what's on screen, filters included.
 *
 *   <ExportExcelButton
 *     rows={filtered}
 *     filename="Customers"
 *     columns={[
 *       { label: "Name", value: (c) => c.name },
 *       { label: "Paid (SEK)", value: (c) => c.paidTotal },
 *     ]}
 *   />
 */
/**
 * Builds the workbook and saves it. Use this directly when the rows have to be
 * fetched first (e.g. exporting every page, not just the one on screen);
 * otherwise use <ExportExcelButton>.
 */
export async function downloadExcel<T>({
  rows,
  columns,
  filename,
  sheetName,
  notes,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  sheetName?: string;
  notes?: string[];
}) {
  const keys = columns.map((_, i) => `c${i}`);
  const res = await fetch("/api/export/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      sheetName: sheetName || filename,
      notes,
      columns: columns.map((c, i) => ({ key: keys[i], label: c.label })),
      rows: rows.map((row) => {
        const out: Record<string, unknown> = {};
        columns.forEach((c, i) => {
          let v: unknown;
          try {
            v = c.value(row);
          } catch {
            v = ""; // one awkward row must not lose the whole export
          }
          out[keys[i]] = v;
        });
        return out;
      }),
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportExcelButton<T>({
  rows,
  columns,
  filename,
  sheetName,
  notes,
  label = "Export Excel",
  className = "btn btn-ghost btn-sm",
  disabled,
}: {
  rows: T[];
  columns: ExportColumn<T>[];
  /** Base of the downloaded file name — the date is added automatically. */
  filename: string;
  /** Tab name inside the workbook. Defaults to the file name. */
  sheetName?: string;
  /** Lines written above the table, e.g. the filters that were applied. */
  notes?: string[];
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !rows || rows.length === 0;

  async function run() {
    if (busy || empty) return;
    setBusy(true);
    setError(null);
    try {
      await downloadExcel({ rows, columns, filename, sheetName, notes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        className={`${className} ${busy ? "is-disabled" : ""}`}
        onClick={run}
        disabled={disabled || busy || empty}
        title={empty ? "Nothing to export yet" : `Download these ${rows.length} rows as an Excel file`}
      >
        {busy ? "Preparing…" : `📊 ${label}`}
      </button>
      {error && <span className="mt-1 text-[11px] font-semibold text-danger">{error}</span>}
    </span>
  );
}
