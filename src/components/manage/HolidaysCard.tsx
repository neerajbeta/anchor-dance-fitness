"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

type Holiday = { id: string; title: string; startDate: string; endDate: string; location: string | null };
type Loc = { id: string; label: string; flag: string | null };

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Admin list of studio holidays / closures — shown in every student's downloadable calendar. */
export function HolidaysCard() {
  const { can } = usePermissions();
  const editable = can("settings.edit");
  const [list, setList] = useState<Holiday[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [draft, setDraft] = useState({ title: "", startDate: "", endDate: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/holidays").then((r) => r.json()).then((j) => setList(j.data ?? [])).catch(() => {});
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocs(j.data ?? [])).catch(() => {});
  }, []);

  async function save(next: Holiday[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/holidays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidays: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      setList(j.data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const ok = await save([
      ...list,
      { id: "", title: draft.title, startDate: draft.startDate, endDate: draft.endDate || draft.startDate, location: draft.location || null },
    ]);
    if (ok) setDraft({ title: "", startDate: "", endDate: "", location: "" });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card">
      <div className="card-title">🏖️ Holidays &amp; Closures</div>
      <p className="-mt-1 mb-3 text-[12px] text-muted">
        Days the studio is closed. They appear in every student&apos;s downloadable class calendar, and classes on these
        days are left out of it.
      </p>

      {list.length === 0 ? (
        <div className="mb-3 rounded-lg border-[1.5px] border-dashed border-line py-4 text-center text-[12px] text-muted">No holidays added yet.</div>
      ) : (
        <div className="mb-3 overflow-hidden rounded-lg border-[1.5px] border-line">
          {list.map((h) => (
            <div key={h.id} className={`flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 ${h.endDate < today ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">{h.title}</div>
                <div className="text-[11px] text-muted">
                  {h.startDate === h.endDate ? fmt(h.startDate) : `${fmt(h.startDate)} – ${fmt(h.endDate)}`} ·{" "}
                  {h.location ?? "All studios"}
                  {h.endDate < today ? " · past" : ""}
                </div>
              </div>
              {editable && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(list.filter((x) => x.id !== h.id))}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <input className="field" placeholder="e.g. Christmas break" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <input className="field" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} title="From" />
          <input className="field" type="date" value={draft.endDate} min={draft.startDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} title="Until (optional)" />
          <select className="field" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
            <option value="">All studios</option>
            {locs.map((l) => (
              <option key={l.id} value={l.label}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>
          <button type="button" className={`btn btn-primary ${busy ? "is-disabled" : ""}`} disabled={busy || !draft.title.trim() || !draft.startDate} onClick={add}>
            + Add
          </button>
        </div>
      )}
      {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
    </div>
  );
}
