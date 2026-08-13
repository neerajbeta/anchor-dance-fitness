"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string };

export function CategoriesManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const j = await fetch("/api/categories").then((r) => r.json());
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
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fd.get("name") }),
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
    if (!confirm("Remove this category?")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card">
      <div className="card-title">🏷️ All Categories</div>

      <div className="mb-4 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No categories yet — add one below.
          </div>
        )}
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <span className="badge badge-brand">{c.name}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
          Add category
        </div>
        <div className="flex gap-3">
          <input
            name="name"
            className="field flex-1"
            placeholder="Category name * (e.g. Hip Hop, Salsa)"
            required
          />
          <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>+ Add</button>
        </div>
        {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
      </form>
    </div>
  );
}
