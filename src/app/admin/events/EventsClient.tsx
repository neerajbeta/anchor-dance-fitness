"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { type EventItem } from "@/lib/data";
import { LocationSelect } from "@/components/LocationSelect";

// Full 24h, 30-min steps: 00:00 → 23:30
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export function EventsClient({
  events,
  source,
}: {
  events: EventItem[];
  source: "database" | "mock";
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [type, setType] = useState<"workshop" | "event">("workshop");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startT, setStartT] = useState("");
  const [endT, setEndT] = useState("");
  const [coupons, setCoupons] = useState<{ code: string; percent: number }[]>([]);

  useEffect(() => {
    fetch("/api/discounts")
      .then((r) => r.json())
      .then((j) => setCoupons(j.data ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const startDate = String(fd.get("startDate") || "");
    const endDate = String(fd.get("endDate") || startDate);
    const start = String(fd.get("start") || "");
    const end = String(fd.get("end") || "");
    if (endDate && startDate && endDate < startDate) {
      setError("End date must be on or after start date");
      setBusy(false);
      return;
    }
    if (start && end && end <= start) {
      setError("End time must be after start time");
      setBusy(false);
      return;
    }
    const dateLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
    const payload = {
      kind: type,
      mode,
      title: fd.get("name"),
      location: fd.get("location"),
      coach: fd.get("instructor"),
      price: Number(fd.get("price") || 0),
      seatsTotal: Number(fd.get("maxSeats") || 0),
      description: fd.get("description"),
      date: [dateLabel, start && `${start}–${end}`].filter(Boolean).join(" · "),
      eventDate: startDate,
      endDate,
      startTime: start,
      endTime: end,
      couponCode: fd.get("couponCode") || "",
    };
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      setModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Failed to delete event.");
  }

  return (
    <AdminShell>
      <SectionHead
        title="Events & Workshops"
        sub="Create and manage all ad-hoc sessions and events"
        right={
          <div className="flex items-center gap-2">
            {source === "database" ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              + Create New Event
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-4 py-3.5 shadow-card">
        <FilterGroup label="Type:" opts={["All", "🎭 Workshops", "⭐ Events"]} />
        <div className="mx-1 h-6 w-px bg-line" />
        <FilterGroup label="Status:" opts={["All", "Upcoming", "Past"]} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((e) => (
          <EventAdminCard key={e.id} e={e} onDelete={handleDelete} />
        ))}

        <button
          onClick={() => setModal(true)}
          className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line bg-white text-muted transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <div className="mb-2 text-3xl">+</div>
          <div className="font-bold">Create New Event</div>
          <div className="mt-1 text-[13px]">Workshop or Event</div>
        </button>
      </div>

      {events.length === 0 && (
        <p className="mt-4 text-center text-[13px] text-muted">
          No events yet — click <span className="font-semibold text-brand-600">Create New Event</span>{" "}
          to publish your first workshop or event.
        </p>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setModal(false)}
        >
          <form
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <div className="mb-1 font-display text-lg font-bold text-ink">Create New Event</div>
            <p className="mb-4 text-[13px] text-slate">
              Set up a workshop or special event. It is saved to the database and appears on the
              public listing.
            </p>

            <div className="mb-3">
              <label className="field-label">Type *</label>
              <Toggle
                a={["🎭 Workshop", type === "workshop"]}
                b={["⭐ Event", type === "event"]}
                onA={() => setType("workshop")}
                onB={() => setType("event")}
              />
            </div>

            <div className="mb-3">
              <label className="field-label">Name *</label>
              <input name="name" className="field" placeholder="e.g. Latin Rhythms Intensive" required />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Location *</label>
                <LocationSelect name="location" withCountry required />
              </div>
              <div>
                <label className="field-label">Mode *</label>
                <Toggle
                  a={["💻 Online", mode === "online"]}
                  b={["🏃 In-Person", mode === "offline"]}
                  onA={() => setMode("online")}
                  onB={() => setMode("offline")}
                />
              </div>
              <div>
                <label className="field-label">Start Date *</label>
                <input name="startDate" className="field" type="date" required />
              </div>
              <div>
                <label className="field-label">End Date *</label>
                <input name="endDate" className="field" type="date" required />
              </div>
              <div>
                <label className="field-label">Instructor *</label>
                <input name="instructor" className="field" placeholder="Coach name" />
              </div>
              <div>
                <label className="field-label">Start Time *</label>
                <select
                  name="start"
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
                  name="end"
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
              <div>
                <label className="field-label">Max Seats *</label>
                <input name="maxSeats" className="field" type="number" placeholder="20" required />
              </div>
              <div>
                <label className="field-label">Price (SEK) *</label>
                <input name="price" className="field" type="number" placeholder="450" required />
              </div>
            </div>

            <div className="mt-3">
              <label className="field-label">Description</label>
              <textarea name="description" className="field" rows={2} placeholder="Shown on public listing..." />
            </div>

            <div className="mt-3">
              <label className="field-label">Coupon (optional)</label>
              <select name="couponCode" className="field" defaultValue="">
                <option value="">No coupon</option>
                {coupons.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.percent}% off
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-muted">
                Codes come from Discount Master. Applied to this event&apos;s price at booking.
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button type="submit" className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>
                {busy ? "Creating…" : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

function EventAdminCard({ e, onDelete }: { e: EventItem; onDelete: (id: string) => void }) {
  const accent = e.kind === "workshop" ? "#E0972B" : "#8B5CF6";
  const registered = Math.max(0, e.seatsTotal - e.seatsLeft);
  return (
    <div
      className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="p-3.5 pb-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`badge ${e.kind === "workshop" ? "badge-warn" : "badge-grape"}`}>
              {e.kind === "workshop" ? "🎭 WORKSHOP" : "⭐ EVENT"}
            </span>
            <span className={`badge ${e.past ? "badge-gray" : "badge-ok"}`}>
              {e.past ? "Past" : "Open"}
            </span>
          </div>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm">✏️ Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(e.id)}>
              🗑
            </button>
          </div>
        </div>
        <div className="mb-1 text-[11px] font-bold" style={{ color: accent }}>
          {e.date}
        </div>
        <div className="mb-1 text-sm font-bold text-ink">{e.title}</div>
        <div className="mb-2 text-[13px] text-muted">
          {e.coach ? `${e.coach} · ` : ""}
          {e.location} · SEK {e.price}
        </div>
        <div className="mb-3 flex gap-2">
          <span className={`badge ${e.mode === "online" ? "badge-info" : "badge-ok"}`}>
            {e.mode === "online" ? "💻 Online" : "🏃 In-Person"}
          </span>
          <span className="badge badge-gray">
            {registered} / {e.seatsTotal} registered
          </span>
        </div>
      </div>
      <div className="px-3.5 pb-3.5 text-[11px] text-muted">No media uploaded yet.</div>
    </div>
  );
}

function Toggle({
  a,
  b,
  onA,
  onB,
}: {
  a: [string, boolean];
  b: [string, boolean];
  onA: () => void;
  onB: () => void;
}) {
  return (
    <div className="flex w-fit overflow-hidden rounded-lg border-2 border-line">
      <button
        type="button"
        onClick={onA}
        className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
          a[1] ? "bg-ink text-white" : "bg-white text-slate"
        }`}
      >
        {a[0]}
      </button>
      <button
        type="button"
        onClick={onB}
        className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
          b[1] ? "bg-ink text-white" : "bg-white text-slate"
        }`}
      >
        {b[0]}
      </button>
    </div>
  );
}

function FilterGroup({ label, opts }: { label: string; opts: string[] }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      {opts.map((o, i) => (
        <button
          key={o}
          onClick={() => setActive(i)}
          className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors ${
            active === i
              ? "border-ink bg-ink text-white"
              : "border-line bg-white text-slate hover:border-brand-400 hover:text-brand-600"
          }`}
        >
          {o}
        </button>
      ))}
    </>
  );
}
