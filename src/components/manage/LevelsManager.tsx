"use client";

import { useEffect, useState } from "react";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Level = { id: string; name: string };

export function LevelsManager() {
  const [items, setItems] = useState<Level[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Level | null>(null);

  async function load() {
    const j = await fetch("/api/levels").then((r) => r.json());
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
    try {
      const res = await fetch(editing ? `/api/levels/${editing.id}` : "/api/levels", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fd.get("name") }),
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

  function cancelEdit() {
    setEditing(null);
    setError(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this level?")) return;
    await fetch(`/api/levels/${id}`, { method: "DELETE" });
    if (editing?.id === id) cancelEdit();
    load();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="card-title">🎚️ All Levels</div>
        <ExportExcelButton
          rows={items}
          filename="Levels"
          notes={[`Class levels — ${items.length}`]}
          columns={[{ label: "Level", value: (l) => l.name }]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No levels yet — add one below.
          </div>
        )}
        {items.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <span className="badge badge-brand">{l.name}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(l)}>
                Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(l.id)}>
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
          {editing ? "Edit level" : "Add level"}
        </div>
        <div className="flex gap-3">
          <input
            name="name"
            className="field flex-1"
            placeholder="Level name * (e.g. Beginner, Intermediate)"
            defaultValue={editing?.name}
            required
          />
          <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
            {editing ? "Save" : "+ Add"}
          </button>
          {editing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
        {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
      </form>
    </div>
  );
}
