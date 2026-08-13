"use client";

import { useEffect, useState } from "react";
import { COUNTRIES, flagFromCode } from "@/lib/countries";

type Location = { id: string; label: string; country: string | null; flag: string | null };

export function LocationsManager() {
  const [items, setItems] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const j = await fetch("/api/locations").then((r) => r.json());
    setItems(j.data ?? []);
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
    const code = String(fd.get("countryCode") || "");
    const country = COUNTRIES.find((c) => c.code === code);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: fd.get("label"),
          country: country?.name ?? "",
          flag: flagFromCode(code),
        }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this location?")) return;
    await fetch(`/api/locations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card">
      <div className="card-title">📍 All Locations</div>

      <div className="mb-4 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No locations yet — add one below.
          </div>
        )}
        {items.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
          >
            <div className="text-[13px] font-bold text-ink">
              {l.flag} {l.label}
              {l.country ? <span className="ml-1 font-normal text-muted">· {l.country}</span> : null}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(l.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
          Add location
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="label" className="field" placeholder="City *" required />
          <select name="countryCode" className="field" required defaultValue="">
            <option value="" disabled>
              Country * (flag added automatically)
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {flagFromCode(c.code)} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-1.5 text-[11px] text-muted">
          The flag emoji is set automatically from the country you pick.
        </div>
        {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
        <button className={`btn btn-primary btn-sm mt-3 ${busy ? "is-disabled" : ""}`}>
          + Add Location
        </button>
      </form>
    </div>
  );
}
