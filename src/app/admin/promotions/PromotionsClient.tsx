"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { usePermissions } from "@/lib/usePermissions";

type Promo = {
  id: string;
  name: string;
  slug: string;
  channel: string;
  eventId: string | null;
  landing: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  clicks: number;
  notes: string | null;
  createdAt: string;
  event: { id: string; title: string; kind: string } | null;
  enquiries: number;
  openEnquiries: number;
  bookings: number;
  revenue: number;
};
type EventRow = { id: string; title: string; kind: string; eventDate: string | null; endDate: string | null };
type Activity = {
  enquiries: { id: string; fullName: string; email: string; phone: string; phoneCountryCode: string | null; kind: string; additionalInfo: string | null; status: string; createdAt: string }[];
  bookings: { id: string; name: string; email: string; type: string; detail: string | null; amount: number; paid: string; status: string; createdAt: string }[];
};

const CHANNELS: Record<string, string> = {
  instagram: "📸 Instagram",
  facebook: "👍 Facebook",
  whatsapp: "💬 WhatsApp",
  email: "✉️ Email",
  flyer: "📄 Flyer / poster",
  google: "🔎 Google",
  other: "✨ Other",
};
const LANDINGS: Record<string, string> = { workshops: "Workshops & Events page", class: "Book a Class", studio: "Studio Hire", home: "Home page" };

const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;
const blank = { name: "", slug: "", channel: "instagram", eventId: "", landing: "workshops", startDate: "", endDate: "", notes: "" };

export function PromotionsClient() {
  const { can } = usePermissions();
  const canEdit = can("enquiries.edit");
  const [items, setItems] = useState<Promo[]>([]);
  const [eventList, setEventList] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = () =>
    fetch("/api/promotions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setItems(j.data ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
    fetch("/api/events")
      .then((r) => r.json())
      .then((j) => setEventList(j.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!openId) return setActivity(null);
    setActivity(null);
    fetch(`/api/promotions/${openId}`)
      .then((r) => r.json())
      .then((j) => setActivity(j.data ?? null));
  }, [openId]);

  const totals = useMemo(
    () =>
      items.reduce(
        (t, p) => ({ clicks: t.clicks + p.clicks, enquiries: t.enquiries + p.enquiries, open: t.open + p.openEnquiries, bookings: t.bookings + p.bookings, revenue: t.revenue + p.revenue }),
        { clicks: 0, enquiries: 0, open: 0, bookings: 0, revenue: 0 }
      ),
    [items]
  );

  const upcomingEvents = eventList.filter((e) => (e.endDate ?? e.eventDate ?? "9999") >= new Date().toISOString().slice(0, 10));

  function startCreate() {
    setEditingId(null);
    setForm({ ...blank });
    setError(null);
  }
  function startEdit(p: Promo) {
    setEditingId(p.id);
    setForm({ name: p.name, slug: p.slug, channel: p.channel, eventId: p.eventId ?? "", landing: p.landing, startDate: p.startDate ?? "", endDate: p.endDate ?? "", notes: p.notes ?? "" });
    setError(null);
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/promotions/${editingId}` : "/api/promotions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, eventId: form.eventId || null, startDate: form.startDate || null, endDate: form.endDate || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      setForm(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Promo) {
    await fetch(`/api/promotions/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !p.active }) });
    load();
  }

  async function remove(p: Promo) {
    if (!confirm(`Delete "${p.name}"? Its link stops working. Enquiries and bookings it brought in are kept.`)) return;
    await fetch(`/api/promotions/${p.id}`, { method: "DELETE" });
    if (openId === p.id) setOpenId(null);
    load();
  }

  function copy(p: Promo) {
    const link = `${origin}/p/${p.slug}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(p.id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <SectionHead
        title="Promotions"
        sub="A trackable link for every campaign — see the clicks, enquiries and bookings each one brings in"
        right={
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={items}
              filename="Promotions"
              notes={[`Promotions — ${items.length} campaigns`]}
              columns={[
                { label: "Name", value: (p) => p.name },
                { label: "Channel", value: (p) => CHANNELS[p.channel]?.replace(/^\S+\s/, "") ?? p.channel },
                { label: "Link", value: (p) => p.landing },
                { label: "Slug", value: (p) => p.slug },
                { label: "Workshop / event", value: (p) => p.event?.title ?? "" },
                { label: "Starts", value: (p) => p.startDate ?? "" },
                { label: "Ends", value: (p) => p.endDate ?? "" },
                { label: "Active", value: (p) => (p.active ? "Yes" : "No") },
                { label: "Clicks", value: (p) => p.clicks },
                { label: "Enquiries", value: (p) => p.enquiries },
                { label: "Open enquiries", value: (p) => p.openEnquiries },
                { label: "Bookings", value: (p) => p.bookings },
                { label: "Revenue (SEK)", value: (p) => p.revenue },
                { label: "Notes", value: (p) => p.notes ?? "" },
                { label: "Created", value: (p) => p.createdAt?.slice(0, 10) ?? "" },
              ]}
            />
            {canEdit && (
              <button className="btn btn-primary" onClick={startCreate}>
                + New promotion
              </button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="👆 Link clicks" value={totals.clicks} />
        <Tile label="📨 Enquiries" value={totals.enquiries} />
        <Tile label="📞 Awaiting follow-up" value={totals.open} tone="!text-warn" />
        <Tile label="✅ Paid bookings" value={totals.bookings} tone="!text-ok" />
        <Tile label="💰 Revenue" value={sek(totals.revenue)} />
      </div>

      <div className="mb-4 rounded-xl border-[1.5px] border-dashed border-line bg-white px-4 py-3 text-[12px] text-slate">
        <strong className="text-ink">How it works:</strong> put a promotion&apos;s link in the Instagram bio, a Facebook ad, a WhatsApp
        message or a flyer QR code. Anyone who opens it is remembered for 30 days — questions they ask about a workshop, &quot;Book a
        Demo&quot; requests and bookings they make are credited to that promotion and land in{" "}
        <a href="/admin/enquiries" className="font-semibold text-brand-600">
          Enquiries
        </a>{" "}
        for follow-up.
      </div>

      <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>Promotion</th>
                <th>Link</th>
                <th>Clicks</th>
                <th>Enquiries</th>
                <th>Bookings</th>
                <th>Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-3xl">📣</div>
                    <div className="mt-2 font-bold text-ink">No promotions yet</div>
                    <div className="mt-1 text-[13px] text-muted">Create one for your next Instagram post, ad or flyer.</div>
                  </td>
                </tr>
              )}
              {items.map((p) => {
                const conv = p.clicks ? Math.round(((p.enquiries + p.bookings) / p.clicks) * 100) : 0;
                return (
                  <Row key={p.id}>
                    <tr className={p.active ? "" : "opacity-60"}>
                      <td>
                        <div className="font-bold text-ink">{p.name}</div>
                        <div className="text-[11px] text-muted">
                          {CHANNELS[p.channel] ?? p.channel} · {p.event ? `${p.event.kind === "workshop" ? "🎭" : "⭐"} ${p.event.title}` : LANDINGS[p.landing]}
                          {p.startDate || p.endDate ? ` · ${p.startDate ?? "…"} → ${p.endDate ?? "…"}` : ""}
                        </div>
                        {!p.active && <span className="badge badge-gray mt-1">Paused</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        <code className="rounded bg-cream px-1.5 py-0.5 text-[11px]">/p/{p.slug}</code>
                        <button className="ml-1 text-[11px] font-semibold text-brand-600" onClick={() => copy(p)}>
                          {copied === p.id ? "✓ Copied" : "Copy"}
                        </button>
                      </td>
                      <td className="text-[13px] font-bold text-ink">{p.clicks}</td>
                      <td className="text-[13px]">
                        <strong className="text-ink">{p.enquiries}</strong>
                        {p.openEnquiries > 0 && <div className="text-[10px] font-semibold text-warn">{p.openEnquiries} to follow up</div>}
                      </td>
                      <td className="text-[13px]">
                        <strong className="text-ink">{p.bookings}</strong>
                        {p.clicks > 0 && <div className="text-[10px] text-muted">{conv}% of clicks acted</div>}
                      </td>
                      <td className="whitespace-nowrap text-[13px] font-semibold text-ink">{p.revenue ? sek(p.revenue) : "—"}</td>
                      <td>
                        <div className="flex flex-nowrap gap-1">
                          <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                            {openId === p.id ? "Hide" : "Leads"}
                          </button>
                          {canEdit && (
                            <>
                              <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => startEdit(p)}>
                                ✏️
                              </button>
                              <button className="btn btn-ghost btn-sm" title={p.active ? "Pause" : "Resume"} onClick={() => toggleActive(p)}>
                                {p.active ? "⏸️" : "▶️"}
                              </button>
                              <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => remove(p)}>
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openId === p.id && (
                      <tr>
                        <td colSpan={7} className="bg-cream/30">
                          {!activity ? (
                            <div className="py-3 text-[12px] text-muted">Loading…</div>
                          ) : (
                            <div className="grid gap-4 py-2 lg:grid-cols-2">
                              <div>
                                <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">Enquiries ({activity.enquiries.length})</div>
                                {activity.enquiries.length === 0 ? (
                                  <div className="text-[12px] text-muted">None yet.</div>
                                ) : (
                                  activity.enquiries.map((e) => (
                                    <div key={e.id} className="mb-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[12px]">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-ink">{e.fullName}</span>
                                        <span className={`badge ${e.status === "new" ? "badge-warn" : e.status === "contacted" ? "badge-info" : "badge-ok"}`}>{e.status}</span>
                                      </div>
                                      <div className="text-muted">
                                        {e.email} · {e.phoneCountryCode ?? ""} {e.phone} · {e.kind === "workshop" ? "🎭 Workshop question" : "📅 Book a Demo"}
                                      </div>
                                      {e.additionalInfo && <div className="mt-1 text-slate">&quot;{e.additionalInfo}&quot;</div>}
                                    </div>
                                  ))
                                )}
                              </div>
                              <div>
                                <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">Bookings ({activity.bookings.length})</div>
                                {activity.bookings.length === 0 ? (
                                  <div className="text-[12px] text-muted">None yet.</div>
                                ) : (
                                  activity.bookings.map((b) => (
                                    <div key={b.id} className="mb-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[12px]">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-ink">
                                          {b.name} · {b.id}
                                        </span>
                                        <span className={`badge ${b.paid === "paid" ? "badge-ok" : "badge-gray"}`}>{b.paid === "paid" ? sek(b.amount) : b.status}</span>
                                      </div>
                                      <div className="text-muted">{b.detail}</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={() => setForm(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-pop animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between">
              <div className="font-display text-lg font-bold text-ink">{editingId ? "Edit promotion" : "New promotion"}</div>
              <button type="button" className="text-xl leading-none text-muted" onClick={() => setForm(null)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="mb-4 text-[13px] text-slate">You&apos;ll get a link to use in the post, ad or flyer.</p>
            <label className="field-label">Name *</label>
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Bollywood — Instagram" />
            <label className="field-label mt-3">Link name</label>
            <div className="flex items-center gap-1 text-[13px] text-muted">
              <span>{origin}/p/</span>
              <input className="field" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="summer-bollywood (made from the name if empty)" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Channel</label>
                <select className="field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  {Object.entries(CHANNELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Promotes</label>
                <select className="field" value={form.eventId || `landing:${form.landing}`} onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith("landing:")) setForm({ ...form, eventId: "", landing: v.slice(8) });
                  else setForm({ ...form, eventId: v });
                }}>
                  <optgroup label="A workshop / event">
                    {upcomingEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.kind === "workshop" ? "🎭" : "⭐"} {ev.title}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="A page">
                    {Object.entries(LANDINGS).map(([v, l]) => (
                      <option key={v} value={`landing:${v}`}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="field-label">Runs from</label>
                <input type="date" className="field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Until</label>
                <input type="date" className="field" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted">Outside these dates the link still works, but visits aren&apos;t credited.</p>
            <label className="field-label mt-3">Notes</label>
            <textarea className="field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Budget, audience, who's running it…" />
            {error && <div className="mt-3 text-xs font-semibold text-danger">{error}</div>}
            <div className="mt-4 flex justify-between">
              <button className="btn btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className={`btn btn-primary ${busy ? "is-disabled" : ""}`} disabled={busy || !form.name.trim()} onClick={save}>
                {busy ? "Saving…" : editingId ? "Save" : "Create promotion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tile({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
    </div>
  );
}
