"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";
import { INTERVAL_LABELS, INTERVAL_MONTHS, PLAN_INTERVALS, sortPlans, type Plan } from "@/lib/plans";

export function PlansManager() {
  const { can } = usePermissions();
  const [items, setItems] = useState<Plan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  async function load() {
    const res = await fetch("/api/plans?admin=1");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setError(j.error || "Failed to load plans");
    setItems(sortPlans((j.data ?? []) as Plan[]));
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch(editing ? `/api/plans/${editing.id}` : "/api/plans", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          interval: fd.get("interval"),
          price: fd.get("price"),
          description: fd.get("description"),
          active: fd.get("active") === "on",
        }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Plan) {
    const res = await fetch(`/api/plans/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) alert(jr.error || "Failed to update plan");
    load();
  }

  async function remove(p: Plan) {
    if (!confirm(`Delete the "${p.name}" plan? Students will no longer be able to pick it.`)) return;
    const res = await fetch(`/api/plans/${p.id}`, { method: "DELETE" });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to delete plan");
      return;
    }
    if (editing?.id === p.id) setEditing(null);
    load();
  }

  const canCreate = can("plans.create");
  const canEdit = can("plans.edit");
  const canDelete = can("plans.delete");
  const showForm = editing ? canEdit : canCreate;

  return (
    <div className="card">
      <div className="card-title">💳 All Plans</div>

      <div className="mb-4 flex flex-col gap-2">
        {loaded && items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No plans yet — add one below. Students can&apos;t check out until at least one plan is active.
          </div>
        )}
        {items.map((p) => {
          const months = INTERVAL_MONTHS[p.interval];
          return (
            <div
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 ${
                p.active ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink">
                  {p.name}
                  <span className="badge badge-brand">{INTERVAL_LABELS[p.interval]}</span>
                  {!p.active && <span className="badge badge-gray">Inactive</span>}
                </div>
                <div className="mt-0.5 text-[12px] text-slate">
                  SEK {p.price.toLocaleString()}
                  {months > 0 ? " / month" : " once"}
                  {p.description ? ` · ${p.description}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(p)}>
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                )}
                {canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <form
          onSubmit={save}
          key={editing?.id ?? "new"}
          className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5"
        >
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
            {editing ? `Edit plan — ${editing.name}` : "Add plan"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="name" className="field" placeholder="Plan name * (e.g. Quarterly)" defaultValue={editing?.name} required />
            <select name="interval" className="field" defaultValue={editing?.interval ?? "monthly"} required>
              {PLAN_INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {INTERVAL_LABELS[i]}
                </option>
              ))}
            </select>
            <input
              name="price"
              type="number"
              min={0}
              step={1}
              className="field"
              placeholder="Price (SEK) *"
              defaultValue={editing?.price}
              required
            />
            <input
              name="description"
              className="field"
              placeholder="Short description (optional)"
              defaultValue={editing?.description ?? ""}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input name="active" type="checkbox" defaultChecked={editing?.active ?? true} />
            Active — shown to students and in Book on Behalf
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Recurring plans: the price is per month. For class bookings the student pays the class&apos;s
            monthly price × the plan&apos;s months. Demo / one-time plans charge this price once.
          </p>
          <div className="mt-3 flex gap-2">
            <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
              {editing ? "Save" : "+ Add Plan"}
            </button>
            {editing && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
            )}
          </div>
          {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
        </form>
      )}
      {!showForm && error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
    </div>
  );
}
