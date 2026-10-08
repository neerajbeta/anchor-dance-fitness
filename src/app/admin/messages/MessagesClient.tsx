"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { usePermissions } from "@/lib/usePermissions";
import { EMAIL_LOGO_PATH, renderEmail } from "@/lib/email/render";
import { templateDef } from "@/lib/email/defaults";

type Loc = { id: string; label: string; flag: string | null };
type ClassRow = { id: string; name: string; location: string; startTime: string; endTime: string; days: string | null };
type EventRow = { id: string; title: string; kind: string; eventDate: string | null; endDate: string | null };
type Preview = { count: number; label: string; sample: { name: string; email: string; location: string | null }[] };
type Sent = {
  id: string;
  subject: string;
  audienceLabel: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  error: string | null;
  announcementId: string | null;
  createdBy: string | null;
  createdAt: string;
};

const TYPES = [
  { v: "class", l: "💃 Classes" },
  { v: "workshop", l: "🎭 Workshops" },
  { v: "event", l: "⭐ Events" },
  { v: "studio", l: "🏛️ Studio hire" },
];
const STATUSES = [
  { v: "active", l: "Active" },
  { v: "paused", l: "Paused" },
  { v: "dropped", l: "Dropped off" },
];
const TEMPLATES = [
  {
    l: "🏖️ Holiday closure",
    subject: "Studio closed on {date}",
    message: "Our studio will be **closed on {date}** for {holiday}.\n\nClasses continue as usual from {restart date}. Enjoy the break! 🌼",
  },
  {
    l: "🚀 New batch launch",
    subject: "New batch: {class name} starts {date}",
    message: "We're starting a **new {class name} batch** on {date}.\n\n- Days: {days}\n- Time: {time}\n- Location: {location}\n\nSeats are limited — book now from your portal.",
  },
  {
    l: "⏰ Schedule change",
    subject: "Change to your class schedule",
    message: "From {date}, **{class name}** moves to {new time}.\n\nIf the new time doesn't suit you, just reply to this email and we'll help.",
  },
];

const STATUS_BADGE: Record<string, string> = { sent: "badge-ok", partial: "badge-warn", failed: "badge-danger", logged: "badge-gray", sending: "badge-info" };
const STATUS_TEXT: Record<string, string> = { sent: "Sent", partial: "Partly sent", failed: "Failed", logged: "Not sent (email not set up)", sending: "Sending…" };

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function MessagesClient() {
  const { can } = usePermissions();
  const canSend = can("announcements.create");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(["active"]);
  const [currentOnly, setCurrentOnly] = useState(true);
  const [announce, setAnnounce] = useState(false);
  const [announceUntil, setAnnounceUntil] = useState("");

  const [locs, setLocs] = useState<Loc[]>([]);
  const [classList, setClassList] = useState<ClassRow[]>([]);
  const [eventList, setEventList] = useState<EventRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [history, setHistory] = useState<Sent[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const loadHistory = () =>
    fetch("/api/bulk-messages", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setHistory(j.data ?? []))
      .catch(() => {});

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocs(j.data ?? [])).catch(() => {});
    fetch("/api/classes").then((r) => r.json()).then((j) => setClassList(j.data ?? [])).catch(() => {});
    fetch("/api/events")
      .then((r) => r.json())
      .then((j) => {
        const today = new Date().toISOString().slice(0, 10);
        setEventList(((j.data ?? []) as EventRow[]).filter((e) => (e.endDate ?? e.eventDate ?? today) >= today));
      })
      .catch(() => {});
    loadHistory();
  }, []);

  const audience = useMemo(
    () => ({ bookingTypes: types, locations, classIds, eventIds, statuses, currentOnly }),
    [types, locations, classIds, eventIds, statuses, currentOnly]
  );

  // Live recipient count as the filters change.
  useEffect(() => {
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(() => {
      fetch("/api/bulk-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", audience }) })
        .then((r) => r.json())
        .then((j) => alive && setPreview(j.data ?? null))
        .catch(() => {})
        .finally(() => alive && setPreviewing(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [audience]);

  const email = useMemo(() => {
    const def = templateDef("bulk_message");
    if (!def) return null;
    const body = def.defaults.body.replace("{{message}}", message || "Your message appears here.");
    const s = (subject || "Your subject").replace(/\{\{\s*first_name\s*\}\}/g, "Priya");
    return renderEmail(
      { ...def.defaults, subject: s, heading: s, body },
      { name: "Priya Sharma", first_name: "Priya", email: "priya@example.com", portal_url: "#", site_name: "Anchor Dance & Fitness" },
      [],
      { logoSrc: EMAIL_LOGO_PATH }
    );
  }, [subject, message]);

  async function send() {
    if (!preview?.count) return;
    if (!confirm(`Send "${subject}" to ${preview.count} customer${preview.count === 1 ? "" : "s"}?\n\nAudience: ${preview.label}`)) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bulk-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", subject, message, audience, announce, announceUntil: announceUntil || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't send");
      const d = j.data;
      setResult(
        d.status === "logged"
          ? `Saved, but not emailed — email isn't set up on this server (POSTMARK_SERVER_TOKEN).`
          : `Sent to ${d.sent} of ${d.recipients}${d.failed ? ` · ${d.failed} failed` : ""}.`
      );
      if (d.status !== "failed") {
        setSubject("");
        setMessage("");
      }
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  const shownClasses = classList.filter((c) => !locations.length || locations.includes(c.location));

  return (
    <>
      <SectionHead title="Bulk Messages" sub="Email an announcement to customers — by class, workshop, location or status" />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="card">
            <div className="card-title">✍️ Message</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <span className="self-center text-[11px] font-bold uppercase tracking-wide text-muted">Start from:</span>
              {TEMPLATES.map((t) => (
                <button
                  key={t.l}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSubject(t.subject);
                    setMessage(t.message);
                  }}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <label className="field-label">Subject *</label>
            <input className="field" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Studio closed on Midsummer's Eve" />
            <label className="field-label mt-3">Message *</label>
            <textarea
              className="field min-h-[160px]"
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={"Write your message…\n\nBlank line = new paragraph · start a line with \"- \" for a bullet · **bold**"}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>
                Each email starts with &quot;Hi &lt;first name&gt;,&quot;. Use <code>{"{{first_name}}"}</code> to add their name anywhere else.
              </span>
              <button type="button" className="font-semibold text-brand-600" onClick={() => setShowEmail((v) => !v)}>
                {showEmail ? "Hide" : "Preview"} email
              </button>
            </div>
            {showEmail && email && (
              <iframe title="Email preview" className="mt-3 h-[520px] w-full rounded-lg border-[1.5px] border-line bg-white" srcDoc={email.html} />
            )}
          </div>

          <div className="card">
            <div className="card-title">🎯 Who gets it</div>

            <Label>Customers with bookings for</Label>
            <Chips opts={TYPES} value={types} onChange={setTypes} emptyLabel="Any booking (or none)" />

            <Label>Location</Label>
            <Chips opts={locs.map((l) => ({ v: l.label, l: `${l.flag ?? ""} ${l.label}` }))} value={locations} onChange={setLocations} emptyLabel="All locations" />

            {shownClasses.length > 0 && (
              <>
                <Label>Specific classes {classIds.length ? `(${classIds.length})` : ""}</Label>
                <div className="max-h-40 overflow-y-auto rounded-lg border-[1.5px] border-line">
                  {shownClasses.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] last:border-b-0 hover:bg-cream/50">
                      <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => setClassIds(toggle(classIds, c.id))} />
                      <span className="font-semibold text-ink">{c.name}</span>
                      <span className="text-muted">
                        {c.days ? `${c.days} · ` : ""}
                        {c.startTime.slice(0, 5)}–{c.endTime.slice(0, 5)} · {c.location}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {eventList.length > 0 && (
              <>
                <Label>Specific workshops / events {eventIds.length ? `(${eventIds.length})` : ""}</Label>
                <div className="max-h-32 overflow-y-auto rounded-lg border-[1.5px] border-line">
                  {eventList.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] last:border-b-0 hover:bg-cream/50">
                      <input type="checkbox" checked={eventIds.includes(e.id)} onChange={() => setEventIds(toggle(eventIds, e.id))} />
                      <span className="font-semibold text-ink">
                        {e.kind === "workshop" ? "🎭" : "⭐"} {e.title}
                      </span>
                      <span className="text-muted">{e.eventDate ?? ""}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <Label>Customer status</Label>
            <Chips opts={STATUSES} value={statuses} onChange={(v) => setStatuses(v.length ? v : ["active"])} />
            <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={currentOnly} onChange={(e) => setCurrentOnly(e.target.checked)} />
              Only customers with a current or upcoming booking
            </label>
            <p className="mt-2 text-[11px] text-muted">Blacklisted customers never receive bulk messages.</p>
          </div>

          <div className="card">
            <div className="card-title">📢 Also show it in the portal</div>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
              Post it as an announcement on every student&apos;s portal too
            </label>
            {announce && (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
                Show until
                <input type="date" className="field w-auto py-1.5" value={announceUntil} onChange={(e) => setAnnounceUntil(e.target.value)} />
                <span>(empty = until removed in Announcements)</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card xl:sticky xl:top-2">
            <div className="card-title">👥 Recipients</div>
            <div className="font-display text-4xl font-bold text-ink">{previewing && !preview ? "…" : preview?.count ?? 0}</div>
            <div className="mb-3 text-[12px] text-muted">{preview?.label ?? "—"}</div>
            {preview && preview.sample.length > 0 && (
              <div className="mb-3 max-h-56 overflow-y-auto rounded-lg border-[1.5px] border-line">
                {preview.sample.map((r) => (
                  <div key={r.email} className="border-b border-line px-3 py-1.5 text-[12px] last:border-b-0">
                    <div className="font-semibold text-ink">{r.name}</div>
                    <div className="text-muted">
                      {r.email}
                      {r.location ? ` · ${r.location}` : ""}
                    </div>
                  </div>
                ))}
                {preview.count > preview.sample.length && (
                  <div className="px-3 py-1.5 text-[11px] text-muted">…and {preview.count - preview.sample.length} more</div>
                )}
              </div>
            )}
            <div className="mb-3 flex gap-1.5 text-[11px]">
              <span className="badge badge-ok">✉️ Email</span>
              <span className="badge badge-gray" title="Comes with the payment-reminder work (#6) — needs an SMS provider">
                SMS · later
              </span>
              <span className="badge badge-gray" title="Comes with the payment-reminder work (#6) — needs a WhatsApp provider">
                WhatsApp · later
              </span>
            </div>
            {error && <div className="mb-2 text-xs font-semibold text-danger">{error}</div>}
            {result && <div className="mb-2 rounded-lg bg-ok/10 px-3 py-2 text-xs font-semibold text-ok">{result}</div>}
            {canSend ? (
              <button
                className={`btn btn-primary btn-block ${busy ? "is-disabled" : ""}`}
                disabled={busy || !subject.trim() || !message.trim() || !preview?.count}
                onClick={send}
              >
                {busy ? "Sending…" : `📣 Send to ${preview?.count ?? 0} customer${preview?.count === 1 ? "" : "s"}`}
              </button>
            ) : (
              <div className="text-[12px] text-muted">You can view messages but not send them.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-display text-[15px] font-bold text-ink">Sent messages</div>
          <ExportExcelButton
            rows={history}
            filename="Sent-messages"
            sheetName="Messages"
            notes={[`Bulk messages sent — ${history.length}`]}
            columns={[
              { label: "Sent", value: (h) => h.createdAt?.slice(0, 16).replace("T", " ") ?? "" },
              { label: "Subject", value: (h) => h.subject },
              { label: "Audience", value: (h) => h.audienceLabel ?? "" },
              { label: "Recipients", value: (h) => h.recipientCount },
              { label: "Delivered", value: (h) => h.sentCount },
              { label: "Failed", value: (h) => h.failedCount },
              { label: "Status", value: (h) => h.status },
              { label: "Error", value: (h) => h.error ?? "" },
              { label: "Sent by", value: (h) => h.createdBy ?? "" },
              { label: "Also in portal", value: (h) => (h.announcementId ? "Yes" : "No") },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Subject</th>
                  <th>Audience</th>
                  <th>Delivered</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted">
                      No messages sent yet.
                    </td>
                  </tr>
                )}
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap text-[12px]">
                      {new Date(h.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      <div className="text-[10px] text-muted">by {h.createdBy ?? "—"}</div>
                    </td>
                    <td className="max-w-[260px] text-[13px] font-semibold text-ink">
                      {h.subject}
                      {h.announcementId && <div className="text-[10px] font-normal text-muted">📢 also posted in the portal</div>}
                    </td>
                    <td className="max-w-[260px] text-[12px] text-slate">{h.audienceLabel}</td>
                    <td className="whitespace-nowrap text-[12px]">
                      <strong className="text-ink">{h.sentCount}</strong> / {h.recipientCount}
                      {h.failedCount > 0 && <div className="text-[10px] font-semibold text-danger">{h.failedCount} failed</div>}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[h.status] ?? "badge-gray"}`} title={h.error ?? undefined}>
                        {STATUS_TEXT[h.status] ?? h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted first:mt-0">{children}</div>;
}

function Chips({ opts, value, onChange, emptyLabel }: { opts: { v: string; l: string }[]; value: string[]; onChange: (v: string[]) => void; emptyLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {emptyLabel && (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${value.length === 0 ? "border-ink bg-ink text-white" : "border-line text-slate hover:border-brand-400"}`}
        >
          {emptyLabel}
        </button>
      )}
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(toggle(value, o.v))}
          className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${value.includes(o.v) ? "border-brand-500 bg-brand-500 text-white" : "border-line text-slate hover:border-brand-400"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
