"use client";

import { useEffect, useState } from "react";
import { FormDatePicker } from "@/components/theme/DatePicker";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Scope = "all" | "category" | "class" | "event" | "workshop" | "studio";

type Discount = {
  id: string;
  name: string;
  code: string;
  type: "percent" | "flat";
  percent: number | null;
  flatAmount: number | null;
  scope: Scope;
  target: string | null;
  validFrom: string | null;
  validUntil: string | null;
};
type Category = { id: string; name: string };
type ClassRow = { id: string; name: string };
type EventRow = { id: string; title: string; kind: "workshop" | "event" };

const SCOPES_WITH_TARGET = new Set<Scope>(["category", "class", "event", "workshop"]);

export function DiscountsManager() {
  const [items, setItems] = useState<Discount[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [cls, setCls] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Discount | null>(null);

  async function load() {
    const [d, c, k, e] = await Promise.all([
      fetch("/api/discounts").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/classes").then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);
    setItems(d.data ?? []);
    setCats(c.data ?? []);
    setCls(k.data ?? []);
    setEvents(e.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function targetLabel(d: Discount) {
    if (d.scope === "all") return "Everything";
    if (d.scope === "studio") return "Studio (all bookings)";
    if (d.scope === "category") return `Category · ${d.target}`;
    if (d.scope === "class") return `Class · ${cls.find((c) => c.id === d.target)?.name ?? d.target}`;
    if (d.scope === "event" || d.scope === "workshop") {
      const label = d.scope === "event" ? "Event" : "Workshop";
      return `${label} · ${events.find((e) => e.id === d.target)?.title ?? d.target}`;
    }
    return d.scope;
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch(editing ? `/api/discounts/${editing.id}` : "/api/discounts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          code: fd.get("code"),
          type,
          percent: type === "percent" ? fd.get("percent") : undefined,
          flatAmount: type === "flat" ? fd.get("flatAmount") : undefined,
          scope,
          target: SCOPES_WITH_TARGET.has(scope) ? fd.get("target") : null,
          validFrom: fd.get("validFrom") || null,
          validUntil: fd.get("validUntil") || null,
        }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      setScope("all");
      setType("percent");
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(d: Discount) {
    setEditing(d);
    setScope(d.scope);
    setType(d.type);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setScope("all");
    setType("percent");
    setError(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this discount?")) return;
    await fetch(`/api/discounts/${id}`, { method: "DELETE" });
    if (editing?.id === id) cancelEdit();
    load();
  }

  const workshops = events.filter((e) => e.kind === "workshop");
  const eventsOnly = events.filter((e) => e.kind === "event");

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="card-title">🏷️ Discount Master</div>
        <ExportExcelButton
          rows={items}
          filename="Discounts"
          notes={[`Discount codes — ${items.length}`]}
          columns={[
            { label: "Code", value: (d) => d.code },
            { label: "Name", value: (d) => d.name },
            { label: "Type", value: (d) => (d.type === "percent" ? "Percent" : "Flat") },
            { label: "Percent", value: (d) => d.percent ?? "" },
            { label: "Flat (SEK)", value: (d) => d.flatAmount ?? "" },
            { label: "Applies to", value: (d) => d.scope },
            { label: "Target", value: (d) => d.target ?? "" },
            { label: "Valid from", value: (d) => d.validFrom ?? "" },
            { label: "Valid until", value: (d) => d.validUntil ?? "" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No discounts yet — add one below.
          </div>
        )}
        {items.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
          >
            <div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <span className="badge badge-brand">{d.code}</span> {d.name}
                <span className="badge badge-ok">
                  {d.type === "flat" ? `SEK ${d.flatAmount} off` : `${d.percent}% off`}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                Applies to: {targetLabel(d)}
                {(d.validFrom || d.validUntil) && (
                  <>
                    {" "}
                    · Valid {d.validFrom ?? "…"} → {d.validUntil ?? "…"}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(d)}>
                Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={add}
        key={editing?.id ?? "new"}
        className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5"
      >
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
          {editing ? "Edit discount" : "Add discount"}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="name" className="field" placeholder="Name * (e.g. Summer Sale)" defaultValue={editing?.name} required />
          <input
            name="code"
            className="field uppercase"
            placeholder="Code * (e.g. SUMMER20)"
            defaultValue={editing?.code}
            required
          />
          <div className="flex overflow-hidden rounded-lg border-2 border-line">
            {(["percent", "flat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-[12px] font-semibold ${
                  type === t ? "bg-ink text-white" : "bg-white text-slate"
                }`}
              >
                {t === "percent" ? "% Percentage" : "SEK Flat"}
              </button>
            ))}
          </div>
          {type === "percent" ? (
            <input
              name="percent"
              className="field"
              type="number"
              min={0}
              max={100}
              placeholder="Percent * (0–100)"
              defaultValue={editing?.percent ?? undefined}
              required
            />
          ) : (
            <input
              name="flatAmount"
              className="field"
              type="number"
              min={0}
              placeholder="Flat amount * (SEK)"
              defaultValue={editing?.flatAmount ?? undefined}
              required
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Valid From (optional)</label>
            <FormDatePicker variant="admin" name="validFrom" defaultValue={editing?.validFrom} placeholder="Any time" />
          </div>
          <div>
            <label className="field-label">Valid Until (optional)</label>
            <FormDatePicker variant="admin" name="validUntil" defaultValue={editing?.validUntil} placeholder="No end date" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className="field"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="all">Applies to: Everything</option>
            <option value="category">Applies to: Category</option>
            <option value="class">Applies to: Class</option>
            <option value="event">Applies to: Event</option>
            <option value="workshop">Applies to: Workshop</option>
            <option value="studio">Applies to: Studio</option>
          </select>
          {scope === "category" && (
            <select name="target" className="field" required defaultValue={editing?.target ?? ""}>
              <option value="" disabled>
                Pick category *
              </option>
              {cats.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {scope === "class" && (
            <select name="target" className="field" required defaultValue={editing?.target ?? ""}>
              <option value="" disabled>
                Pick class *
              </option>
              {cls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {scope === "event" && (
            <select name="target" className="field" required defaultValue={editing?.target ?? ""}>
              <option value="" disabled>
                Pick event *
              </option>
              {eventsOnly.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          )}
          {scope === "workshop" && (
            <select name="target" className="field" required defaultValue={editing?.target ?? ""}>
              <option value="" disabled>
                Pick workshop *
              </option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
        <div className="mt-3 flex gap-2">
          <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
            {editing ? "Save Changes" : "+ Add Discount"}
          </button>
          {editing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
