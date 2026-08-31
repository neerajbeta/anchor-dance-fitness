"use client";

import { useEffect, useState } from "react";

type Tone = "info" | "warning" | "urgent";
type Announcement = {
  id: string;
  title: string;
  message: string;
  tone: Tone;
  createdAt: string;
  expiresAt: string | null;
};

const TONE_META: Record<Tone, { label: string; badge: string }> = {
  info: { label: "Info", badge: "badge-info" },
  warning: { label: "Warning", badge: "badge-warn" },
  urgent: { label: "Urgent", badge: "badge-danger" },
};

export function AnnouncementsManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [tone, setTone] = useState<Tone>("info");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);

  async function load() {
    const j = await fetch("/api/announcements?admin=1").then((r) => r.json());
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
      const res = await fetch(editing ? `/api/announcements/${editing.id}` : "/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          message: fd.get("message"),
          tone,
          expiresAt: fd.get("expiresAt") || null,
        }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      setTone("info");
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(a: Announcement) {
    setEditing(a);
    setTone(a.tone);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setTone("info");
    setError(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this announcement?")) return;
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (editing?.id === id) cancelEdit();
    load();
  }

  return (
    <div className="card">
      <div className="card-title">📩 Announcements</div>

      <div className="mb-4 flex flex-col gap-2">
        {items.length === 0 && (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            No announcements yet — post one below. It appears on every student&apos;s portal.
          </div>
        )}
        {items.map((a) => {
          const closed = a.expiresAt && new Date(a.expiresAt).getTime() <= Date.now();
          return (
          <div
            key={a.id}
            className={`rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 ${closed ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  {a.title}
                  <span className={`badge ${TONE_META[a.tone].badge}`}>{TONE_META[a.tone].label}</span>
                  {closed && <span className="badge badge-danger">Closed</span>}
                </div>
                <div className="mt-1 text-[12px] text-slate">{a.message}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {new Date(a.createdAt).toLocaleString()}
                  {a.expiresAt &&
                    ` · ${closed ? "Closed" : "Closes"} ${new Date(a.expiresAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <form
        onSubmit={add}
        key={editing?.id ?? "new"}
        className="rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5"
      >
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
          {editing ? "Edit announcement" : "Post announcement"}
        </div>
        <input
          name="title"
          className="field mb-3"
          placeholder="Title * (e.g. Studio closed for maintenance)"
          defaultValue={editing?.title}
          required
        />
        <textarea
          name="message"
          className="field mb-3"
          rows={3}
          placeholder="Message *"
          defaultValue={editing?.message}
          required
        />
        <div className="mb-3 flex overflow-hidden rounded-lg border-2 border-line">
          {(["info", "warning", "urgent"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`flex-1 py-2 text-[12px] font-semibold ${
                tone === t ? "bg-ink text-white" : "bg-white text-slate"
              }`}
            >
              {TONE_META[t].label}
            </button>
          ))}
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] font-semibold text-slate">
            Auto-close on (optional)
          </span>
          <input
            type="date"
            name="expiresAt"
            className="field"
            defaultValue={editing?.expiresAt ? editing.expiresAt.slice(0, 10) : undefined}
          />
        </label>
        {error && <div className="mb-2 text-xs font-semibold text-danger">{error}</div>}
        <div className="flex gap-2">
          <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
            {editing ? "Save Changes" : "+ Post Announcement"}
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
