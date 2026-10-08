"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { usePermissions } from "@/lib/usePermissions";

type Channel = "sms" | "email" | "whatsapp";
type Settings = { enabled: boolean; firstAfterDays: number; everyDays: number; channels: [Channel, Channel, Channel] };
type Item = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  customerId: string | null;
  blacklisted: boolean;
  type: string;
  detail: string | null;
  period: string | null;
  location: string;
  amount: number;
  createdAt: string;
  daysUnpaid: number;
  remindersSent: number;
  lastReminderAt: string | null;
  nextStep: number | null;
  nextChannel: Channel | null;
  nextDueAt: string | null;
  due: boolean;
  escalated: boolean;
  history: { step: number; channel: string; sentVia: string | null; status: string; error: string | null; sentBy: string | null; at: string }[];
};
type History = {
  id: string;
  registrationId: string;
  step: number;
  channel: string;
  sentVia: string | null;
  status: string;
  error: string | null;
  sentBy: string | null;
  createdAt: string;
  booking: { name: string; email: string; amount: number } | null;
};

const CH: Record<Channel, { label: string; icon: string }> = {
  sms: { label: "SMS", icon: "📱" },
  email: { label: "Email", icon: "✉️" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
};
const STATUS: Record<string, string> = { sent: "badge-ok", logged: "badge-gray", failed: "badge-danger", skipped: "badge-gray" };
const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;
const when = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

type View = "all" | "due" | "escalated" | "waiting";

export function RemindersClient() {
  const { can } = usePermissions();
  const canSettings = can("settings.edit");
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ email: true, sms: false, whatsapp: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load reminders");
      setItems(j.data.items);
      setSettings(j.data.settings);
      setDraft((d) => d ?? j.data.settings);
      setHistory(j.data.history);
      setChannels(j.data.channels);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load reminders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: items.length,
      due: items.filter((i) => i.due && !i.blacklisted).length,
      escalated: items.filter((i) => i.escalated).length,
      waiting: items.filter((i) => !i.due && !i.escalated).length,
      owed: items.reduce((s, i) => s + i.amount, 0),
    }),
    [items]
  );
  const shown = items.filter((i) => (view === "due" ? i.due && !i.blacklisted : view === "escalated" ? i.escalated : view === "waiting" ? !i.due && !i.escalated : true));

  async function post(body: object, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (j.data?.message) setNotice(j.data.message);
      else if (j.data && "sent" in j.data) setNotice(`${j.data.sent} reminder${j.data.sent === 1 ? "" : "s"} sent${j.data.failed ? ` · ${j.data.failed} failed` : ""}.`);
      else if (j.error) setNotice(j.error);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    if (!draft) return;
    setBusy("settings");
    try {
      const res = await fetch("/api/reminders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      setSettings(j.data);
      setDraft(j.data);
      setNotice("✓ Reminder schedule saved.");
      load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <>
      <SectionHead
        title="Payment Reminders"
        sub="Unpaid bookings get up to 3 reminders, escalating across channels — then they're flagged for a personal follow-up"
        right={
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={shown}
              filename="Payment-reminders"
              sheetName="Unpaid"
              notes={[`Payment reminders — ${view} · ${shown.length} bookings`]}
              columns={[
                { label: "Booking ID", value: (i) => i.id },
                { label: "Name", value: (i) => i.name },
                { label: "Email", value: (i) => i.email },
                { label: "Phone", value: (i) => i.phone ?? "" },
                { label: "Type", value: (i) => i.type },
                { label: "Detail", value: (i) => i.detail ?? "" },
                { label: "Period", value: (i) => i.period ?? "" },
                { label: "Location", value: (i) => i.location },
                { label: "Amount (SEK)", value: (i) => i.amount },
                { label: "Days unpaid", value: (i) => i.daysUnpaid },
                { label: "Reminders sent", value: (i) => i.remindersSent },
                { label: "Last reminder", value: (i) => i.lastReminderAt?.slice(0, 10) ?? "" },
                { label: "Next step", value: (i) => i.nextStep ?? "" },
                { label: "Next channel", value: (i) => i.nextChannel ?? "" },
                { label: "Next due", value: (i) => i.nextDueAt?.slice(0, 10) ?? "" },
                { label: "Due now", value: (i) => (i.due ? "Yes" : "No") },
                { label: "Escalated", value: (i) => (i.escalated ? "Yes" : "No") },
                { label: "Blacklisted", value: (i) => (i.blacklisted ? "Yes" : "No") },
                { label: "Booked", value: (i) => i.createdAt?.slice(0, 10) ?? "" },
              ]}
            />
            <button className={`btn btn-primary btn-sm ${busy === "due" ? "is-disabled" : ""}`} disabled={busy === "due" || counts.due === 0} onClick={() => post({ action: "send-due" }, "due")}>
              {busy === "due" ? "Sending…" : `📩 Send ${counts.due} due reminder${counts.due === 1 ? "" : "s"} now`}
            </button>
          </div>
        }
      />

      {notice && <div className="mb-3 rounded-lg bg-ok/10 px-3 py-2 text-[13px] font-semibold text-ink">{notice}</div>}
      {error && <div className="mb-3 rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["all", "💸 Unpaid bookings", counts.all, `${sek(counts.owed)} owed`, ""],
            ["due", "⏰ Reminder due", counts.due, settings?.enabled ? "Will go out automatically" : "Automatic sending is off", "!text-warn"],
            ["waiting", "⏳ Reminded, waiting", counts.waiting, "Next one scheduled", ""],
            ["escalated", "🚨 Escalated", counts.escalated, "3 reminders sent — call them", "!text-danger"],
          ] as const
        ).map(([k, label, n, sub, tone]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={`stat text-left ${view === k ? "!border-brand-500 ring-2 ring-brand-500/30" : ""}`}>
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${tone}`}>{loading ? "—" : n}</div>
            <div className="stat-sub">{sub}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Booking</th>
                  <th>Amount</th>
                  <th>Unpaid for</th>
                  <th className="min-w-[170px]">Reminders</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-3xl">🎉</div>
                      <div className="mt-2 font-bold text-ink">{items.length ? "Nothing here" : "No unpaid bookings"}</div>
                      <div className="mt-1 text-[13px] text-muted">
                        Unpaid = booked by an admin with &quot;send payment link&quot;, or marked overdue. Online checkouts aren&apos;t counted.
                      </div>
                    </td>
                  </tr>
                )}
                {shown.map((i) => (
                  <Fragment key={i.id}>
                    <tr>
                      <td>
                        <div className="font-bold text-ink">{i.name}</div>
                        <div className="text-[11px] text-muted">
                          {i.email}
                          {i.phone ? ` · ${i.phone}` : ""}
                        </div>
                        {i.blacklisted && <span className="badge badge-danger mt-1">⛔ Blacklisted — no reminders</span>}
                      </td>
                      <td className="max-w-[200px] text-[12px]">
                        <div className="text-ink">{i.detail}</div>
                        <div className="text-[10px] text-muted">
                          {i.id} · {i.location}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-[13px] font-bold text-ink">{sek(i.amount)}</td>
                      <td className="whitespace-nowrap text-[12px]">
                        {i.daysUnpaid} day{i.daysUnpaid === 1 ? "" : "s"}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((s) => {
                            const ch = (settings?.channels[s - 1] ?? "email") as Channel;
                            const done = s <= i.remindersSent;
                            return (
                              <span
                                key={s}
                                title={`Reminder ${s}: ${CH[ch].label}${channels[ch] ? "" : " (by email until connected)"}${done ? " — sent" : ""}`}
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${done ? (i.escalated ? "bg-danger/15" : "bg-brand-500/15") : "bg-line/60 opacity-60"}`}
                              >
                                {CH[ch].icon}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-1 text-[10px] text-muted">
                          {i.escalated
                            ? "🚨 Escalated — follow up personally"
                            : i.due
                            ? `Reminder ${i.nextStep} due now`
                            : `Next ${when(i.nextDueAt)}`}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-nowrap gap-1">
                          {!i.escalated && !i.blacklisted && (
                            <button className="btn btn-ghost btn-sm" disabled={busy === i.id} onClick={() => post({ action: "send", id: i.id }, i.id)}>
                              {busy === i.id ? "…" : `Send #${i.nextStep}`}
                            </button>
                          )}
                          {i.escalated && i.phone && (
                            <a className="btn btn-ghost btn-sm no-underline" href={`tel:${i.phone.replace(/\s/g, "")}`} title="Call">
                              📞
                            </a>
                          )}
                          {i.history.length > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === i.id ? null : i.id)} title="History">
                              🕘
                            </button>
                          )}
                          {i.customerId && (
                            <a className="btn btn-ghost btn-sm no-underline" href="/admin/customers" title="Customers (mark overdue customers, blacklist…)">
                              👤
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open === i.id && (
                      <tr>
                        <td colSpan={6} className="bg-cream/30">
                          {i.history.map((h, n) => (
                            <div key={n} className="flex items-center gap-2 py-1 text-[12px]">
                              <span className={`badge ${STATUS[h.status] ?? "badge-gray"}`}>{h.status}</span>
                              <span className="font-semibold text-ink">Reminder {h.step}</span>
                              <span className="text-slate">{h.sentVia ?? h.channel}</span>
                              <span className="text-muted">
                                {when(h.at)} · {h.sentBy ?? "automatic"}
                              </span>
                              {h.error && <span className="text-danger">{h.error}</span>}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-title">⚙️ Reminder schedule</div>
            {!draft ? (
              <div className="text-[12px] text-muted">Loading…</div>
            ) : (
              <>
                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input type="checkbox" checked={draft.enabled} disabled={!canSettings} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                  Send reminders automatically
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label">First after (days)</label>
                    <input type="number" min={0} max={60} className="field" value={draft.firstAfterDays} disabled={!canSettings} onChange={(e) => setDraft({ ...draft, firstAfterDays: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="field-label">Then every (days)</label>
                    <input type="number" min={1} max={60} className="field" value={draft.everyDays} disabled={!canSettings} onChange={(e) => setDraft({ ...draft, everyDays: Number(e.target.value) })} />
                  </div>
                </div>
                <label className="field-label mt-3">Escalation — channel for each reminder</label>
                {[0, 1, 2].map((n) => (
                  <div key={n} className="mb-1.5 flex items-center gap-2 text-[12px]">
                    <span className="w-20 font-semibold text-ink">Reminder {n + 1}</span>
                    <select
                      className="field py-1.5 text-[12px]"
                      value={draft.channels[n]}
                      disabled={!canSettings}
                      onChange={(e) => {
                        const next = [...draft.channels] as Settings["channels"];
                        next[n] = e.target.value as Channel;
                        setDraft({ ...draft, channels: next });
                      }}
                    >
                      {(Object.keys(CH) as Channel[]).map((c) => (
                        <option key={c} value={c}>
                          {CH[c].icon} {CH[c].label}
                          {channels[c] ? "" : " (email until connected)"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <p className="mt-2 text-[11px] text-muted">
                  After reminder 3 the booking is escalated and shows in the 🔔 bell for someone to call. SMS and WhatsApp aren&apos;t connected
                  yet — those steps are sent by email until a provider is added. Blacklisted customers never get reminders.
                </p>
                {canSettings && (
                  <button className={`btn btn-primary btn-sm mt-3 ${busy === "settings" ? "is-disabled" : ""}`} disabled={!dirty || busy === "settings"} onClick={saveSettings}>
                    {busy === "settings" ? "Saving…" : "Save schedule"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">🕘 Recently sent</div>
            {history.length === 0 ? (
              <div className="text-[12px] text-muted">No reminders sent yet.</div>
            ) : (
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-ink">{h.booking?.name ?? h.registrationId}</span>
                      <span className={`badge ${STATUS[h.status] ?? "badge-gray"}`}>{h.status}</span>
                    </div>
                    <div className="text-[11px] text-muted">
                      #{h.step} · {h.sentVia ?? h.channel} · {when(h.createdAt)} · {h.sentBy ?? "automatic"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
