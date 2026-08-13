"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/data";

type Location = { id: string; label: string };
type Category = { id: string; name: string };
type ClassRow = {
  id: string;
  name: string;
  category: string;
  level: string;
  location: string;
  mode: "online" | "offline";
  days: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  coach: string | null;
  price: number;
  capacity: number;
};

const fmt = (t: string) => t?.slice(0, 5);

// Full 24h, 30-min steps: 00:00 → 23:30
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export function ClassesManager() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"online" | "offline">("offline");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startT, setStartT] = useState("");
  const [endT, setEndT] = useState("");

  async function load() {
    const [c, l, cat] = await Promise.all([
      fetch("/api/classes").then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    setClasses(c.data ?? []);
    setLocations(l.data ?? []);
    setCategories(cat.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const sd = String(fd.get("startDate") || "");
    const ed = String(fd.get("endDate") || "");
    if (sd && ed && ed < sd) {
      setError("End date must be on or after start date");
      setBusy(false);
      return;
    }
    if (String(fd.get("endTime")) <= String(fd.get("startTime"))) {
      setError("End time must be after start time");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          category: fd.get("category"),
          level: fd.get("level"),
          location: fd.get("location"),
          mode,
          days: fd.get("days"),
          startDate: fd.get("startDate"),
          endDate: fd.get("endDate"),
          startTime: fd.get("startTime"),
          endTime: fd.get("endTime"),
          coach: fd.get("coach"),
          price: fd.get("price"),
          capacity: fd.get("capacity"),
        }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      setStartT("");
      setEndT("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this class?")) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    load();
  }

  const noCats = categories.length === 0;
  const noLocs = locations.length === 0;

  return (
    <div className="card">
      <div className="card-title">💃 All Classes</div>

      <div className="mb-4 flex flex-col gap-2">
        {!loading && classes.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No classes yet — add one below. Classes appear in the booking forms and auto-fill their
            time.
          </div>
        )}
        {classes.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
          >
            <div>
              <div className="text-[13px] font-bold text-ink">{c.name}</div>
              <div className="text-[11px] text-muted">
                {c.category} · {c.level} · {c.location} · {c.mode === "online" ? "💻" : "🏃"}
                {c.days ? ` · ${c.days}` : ""} ·{" "}
                <span className="font-semibold text-brand-600">
                  {fmt(c.startTime)}–{fmt(c.endTime)}
                </span>
                {" · "}
                <span className="font-semibold text-ink">SEK {c.price ?? 0}</span>
              </div>
              {c.startDate && c.endDate && (
                <div className="text-[11px] text-muted">
                  📅 {c.startDate} → {c.endDate}
                </div>
              )}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      {(noCats || noLocs) && (
        <div className="mb-3 rounded-lg border-[1.5px] border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12px] text-[#7a5512]">
          {noLocs && "Add a location first. "}
          {noCats && "Add a category first. "}
          Classes need at least one {noLocs ? "location" : ""}
          {noLocs && noCats ? " and " : ""}
          {noCats ? "category" : ""}.
        </div>
      )}

      <form onSubmit={add} className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">Add class</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="name" className="field" placeholder="Class name *" required />
          <input name="coach" className="field" placeholder="Coach" />
          <select name="category" className="field" required defaultValue="">
            <option value="" disabled>
              Category *
            </option>
            {categories.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
          <select name="level" className="field" required defaultValue="">
            <option value="" disabled>
              Level *
            </option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <select name="location" className="field" required defaultValue="">
            <option value="" disabled>
              Location *
            </option>
            {locations.map((l) => (
              <option key={l.id}>{l.label}</option>
            ))}
          </select>
          <input name="days" className="field" placeholder="Days (e.g. Mon, Wed, Fri)" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="field-label">Start Date *</label>
            <input name="startDate" className="field" type="date" required />
          </div>
          <div>
            <label className="field-label">End Date *</label>
            <input name="endDate" className="field" type="date" required />
          </div>
          <div>
            <label className="field-label">Start Time *</label>
            <select
              name="startTime"
              className="field"
              required
              value={startT}
              onChange={(e) => {
                setStartT(e.target.value);
                if (endT && endT <= e.target.value) setEndT("");
              }}
            >
              <option value="" disabled>
                Select
              </option>
              {TIME_SLOTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">End Time *</label>
            <select
              name="endTime"
              className="field"
              required
              value={endT}
              onChange={(e) => setEndT(e.target.value)}
              disabled={!startT}
            >
              <option value="" disabled>
                {startT ? "Select" : "Pick start first"}
              </option>
              {TIME_SLOTS.filter((t) => t > startT).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label">Price (SEK)</label>
            <input name="price" className="field" type="number" min={0} defaultValue={0} />
          </div>
          <div>
            <label className="field-label">Capacity</label>
            <input name="capacity" className="field" type="number" defaultValue={20} />
          </div>
          <div>
            <label className="field-label">Mode</label>
            <div className="flex overflow-hidden rounded-lg border-2 border-line">
              {(["offline", "online"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-[12px] font-semibold ${
                    mode === m ? "bg-ink text-white" : "bg-white text-slate"
                  }`}
                >
                  {m === "online" ? "💻" : "🏃"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
        <button
          className={`btn btn-primary btn-sm mt-3 ${busy || noCats || noLocs ? "is-disabled" : ""}`}
        >
          + Add Class
        </button>
      </form>
    </div>
  );
}
