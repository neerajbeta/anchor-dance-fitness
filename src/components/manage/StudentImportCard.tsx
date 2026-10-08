"use client";

import { useRef, useState } from "react";
import { TEMPLATE_COLUMNS } from "@/lib/studentImport";

type Problem = { line: number; error: string | null };
type PlanRow = { line: number; email: string; name: string; action: "create" | "update"; changes: string[] };
type Preview = {
  preview: true;
  file: string;
  counts: { create: number; update: number; unchanged: number; problems: number };
  rows: PlanRow[];
  problems: Problem[];
};
type Done = { preview: false; file: string; created: number; updated: number; skipped: number; skippedEmails: string[]; problems: Problem[] };

/**
 * Import students from a spreadsheet. The upload is always checked first and
 * shown as a preview — nothing is written until the admin confirms it.
 */
export function StudentImportCard({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [showAll, setShowAll] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    setShowAll(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send(chosen: File, confirm: boolean) {
    setBusy(confirm ? "import" : "check");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", chosen);
      if (confirm) body.append("confirm", "1");
      const res = await fetch("/api/students/import", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `Import failed (${res.status})`);
        // A rejected file can still carry the list of problems.
        if (j.data?.problems?.length) setPreview({ ...(j.data as Preview), preview: true });
        return;
      }
      if (confirm) {
        setDone(j.data as Done);
        setPreview(null);
        onImported?.();
      } else {
        setPreview(j.data as Preview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  function pick(f: File | null) {
    setPreview(null);
    setDone(null);
    setError(null);
    setFile(f);
    if (f) void send(f, false);
  }

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="card-title">📥 Import students from Excel</div>
          <p className="-mt-1 text-[12px] text-muted">
            Upload an .xlsx file to add or update students in bulk. Matching is by <strong>email</strong>: an email
            already on record is updated, a new one is added. A blank cell never erases what&apos;s already stored.
          </p>
        </div>
        <a className="btn btn-ghost btn-sm no-underline" href="/api/students/import/template">
          ⬇️ Download template
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="field w-auto flex-1 text-[13px] file:mr-3 file:rounded file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {(file || preview || done) && (
          <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy !== null}>
            Clear
          </button>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-slate">Which columns does it read?</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="dt text-[12px]">
            <thead>
              <tr>
                <th>Column</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_COLUMNS.map((c) => (
                <tr key={c.key}>
                  <td className="font-semibold text-ink">{c.label}</td>
                  <td className="text-muted">{c.hint || "Optional"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">
            Headings are matched loosely, so &quot;Full Name&quot;, &quot;Mobile&quot; or &quot;Date of Birth&quot;
            all work, and columns we don&apos;t recognise are ignored. Imported students are <strong>not</strong>{" "}
            marked as having given GDPR consent — they&apos;re asked the first time they book.
          </p>
        </div>
      </details>

      {busy === "check" && <div className="mt-3 text-[13px] text-muted">Checking the file…</div>}
      {error && (
        <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-[12px] font-semibold text-danger">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-3 rounded-lg border-[1.5px] border-line bg-cream/50 p-3">
          <div className="text-[13px] font-bold text-ink">
            {preview.file} — nothing has been saved yet
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[12px]">
            <span className="badge badge-ok">{preview.counts.create} new students</span>
            <span className="badge badge-info">{preview.counts.update} existing updated</span>
            {preview.counts.unchanged > 0 && (
              <span className="badge badge-gray">{preview.counts.unchanged} with no changes</span>
            )}
            {preview.counts.problems > 0 && (
              <span className="badge badge-danger">{preview.counts.problems} rows can&apos;t be imported</span>
            )}
          </div>

          {preview.problems.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[12px] font-semibold text-danger">Rows that will be skipped</div>
              <ul className="mt-1 list-inside list-disc text-[12px] text-slate">
                {preview.problems.slice(0, showAll ? undefined : 5).map((p) => (
                  <li key={p.line}>
                    Row {p.line}: {p.error}
                  </li>
                ))}
              </ul>
              {preview.problems.length > 5 && (
                <button className="mt-1 text-[12px] font-semibold text-brand-600" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show fewer" : `Show all ${preview.problems.length}`}
                </button>
              )}
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="mt-2.5 max-h-60 overflow-auto rounded border border-line bg-white">
              <table className="dt text-[12px]">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>What happens</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, showAll ? undefined : 20).map((r) => (
                    <tr key={r.line}>
                      <td className="text-muted">{r.line}</td>
                      <td className="font-semibold text-ink">{r.name}</td>
                      <td className="text-slate">{r.email}</td>
                      <td>
                        {r.action === "create" ? (
                          <span className="badge badge-ok">New student</span>
                        ) : r.changes.length === 0 ? (
                          <span className="badge badge-gray">Already up to date</span>
                        ) : (
                          <span className="text-slate">
                            <span className="badge badge-info mr-1.5">Update</span>
                            {r.changes.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 20 && !showAll && (
                <button className="w-full py-1.5 text-[12px] font-semibold text-brand-600" onClick={() => setShowAll(true)}>
                  Show all {preview.rows.length} rows
                </button>
              )}
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                className={`btn btn-primary btn-sm ${busy === "import" ? "is-disabled" : ""}`}
                disabled={busy !== null || !file}
                onClick={() => file && send(file, true)}
              >
                {busy === "import"
                  ? "Importing…"
                  : `Import ${preview.counts.create + preview.counts.update} student${
                      preview.counts.create + preview.counts.update === 1 ? "" : "s"
                    }`}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy !== null}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-3 rounded-lg border-[1.5px] border-ok/40 bg-ok/5 p-3 text-[13px]">
          <div className="font-bold text-ink">✅ Imported {done.file}</div>
          <div className="mt-1 text-slate">
            {done.created} student{done.created === 1 ? "" : "s"} added · {done.updated} updated
            {done.skipped > 0 ? ` · ${done.skipped} skipped` : ""}
            {done.problems.length > 0 ? ` · ${done.problems.length} rows had problems and were left out` : ""}
          </div>
          {done.skippedEmails.length > 0 && (
            <div className="mt-1 text-[12px] text-muted">
              Skipped (these emails belong to admin or coach accounts): {done.skippedEmails.join(", ")}
            </div>
          )}
          <button className="btn btn-ghost btn-sm mt-2" onClick={reset}>
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
