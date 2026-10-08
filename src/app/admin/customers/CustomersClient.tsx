"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { StudentImportCard } from "@/components/manage/StudentImportCard";
import { usePermissions } from "@/lib/usePermissions";
import {
  ACTION_LABEL,
  BLACKLIST_REASONS,
  CUSTOMER_STATUS_LABEL,
  DROP_REASONS,
  reasonLabel,
  type CustomerAction,
  type CustomerStatus,
} from "@/lib/customers";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  flag: string | null;
  customerStatus: CustomerStatus;
  blacklisted: boolean;
  statusReason: string | null;
  statusNote: string | null;
  statusChangedAt: string | null;
  createdAt: string | null;
  // GDPR consent, as recorded when they signed up or booked — one flag per
  // permission (see lib/consent.ts).
  gdprConsentAt: string | null;
  gdprConsentVersion: string | null;
  mediaConsent: boolean;
  dataConsent: boolean;
  photoConsent: boolean;
  videoConsent: boolean;
  promoConsent: boolean;
  mediaConsentWithdrawnAt: string | null;
  bookings: number;
  classes: number;
  paidTotal: number;
  unpaidCount: number;
  unpaidAmount: number;
  lastBookingAt: string | null;
};

type ReasonStat = { reasonCode: string | null; action: string; count: number };

type Detail = Customer & {
  city: string | null;
  country: string | null;
  age: number | null;
  history: {
    id: string;
    action: CustomerAction;
    fromStatus: string | null;
    toStatus: string | null;
    reasonCode: string | null;
    note: string | null;
    bookingId: string | null;
    actorName: string | null;
    createdAt: string;
  }[];
  bookings: {
    id: string;
    type: string;
    detail: string | null;
    period: string | null;
    plan: string | null;
    location: string;
    amount: number;
    paid: string;
    paymentMethod: string | null;
    status: string;
    statusTone: string;
    discountCode: string | null;
    createdAt: string;
    unpaid: boolean;
  }[];
};

type View = "all" | "active" | "unpaid" | "paused" | "dropped" | "blacklisted";

const VIEWS: { key: View; label: string; icon: string; tone: string; sub: string }[] = [
  { key: "all", label: "All Customers", icon: "👥", tone: "", sub: "Every student" },
  { key: "active", label: "Active", icon: "🟢", tone: "!text-ok", sub: "Currently attending" },
  { key: "unpaid", label: "Unpaid", icon: "💸", tone: "!text-danger", sub: "Owe a payment" },
  { key: "paused", label: "Paused", icon: "⏸️", tone: "!text-warn", sub: "On a break" },
  { key: "dropped", label: "Drop-off", icon: "📉", tone: "!text-slate", sub: "Stopped coming" },
  { key: "blacklisted", label: "Blacklisted", icon: "⛔", tone: "!text-danger", sub: "Can't book" },
];

const STATUS_TONE: Record<CustomerStatus, string> = { active: "badge-ok", paused: "badge-warn", dropped: "badge-gray" };
const TYPE_LABEL: Record<string, string> = { class: "💃 Class", workshop: "🎭 Workshop", event: "⭐ Event", studio: "🏛️ Studio" };

const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

function matchesView(c: Customer, view: View) {
  switch (view) {
    case "active":
      return c.customerStatus === "active" && !c.blacklisted;
    case "unpaid":
      return c.unpaidCount > 0;
    case "paused":
      return c.customerStatus === "paused";
    case "dropped":
      return c.customerStatus === "dropped";
    case "blacklisted":
      return c.blacklisted;
    default:
      return true;
  }
}

export function CustomersClient() {
  const { can } = usePermissions();
  const canEdit = can("customers.edit");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reasons, setReasons] = useState<ReasonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [action, setAction] = useState<{ customer: Customer; action: CustomerAction } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load customers");
      setCustomers(j.data.customers);
      setReasons(j.data.reasons);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.key, customers.filter((c) => matchesView(c, v.key)).length])) as Record<View, number>,
    [customers]
  );
  const unpaidTotal = useMemo(() => customers.reduce((s, c) => s + c.unpaidAmount, 0), [customers]);
  const locations = useMemo(
    () => Array.from(new Set(customers.map((c) => c.location).filter(Boolean) as string[])).sort(),
    [customers]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (!matchesView(c, view)) return false;
      if (location && c.location !== location) return false;
      if (reason && c.statusReason !== reason) return false;
      if (term && ![c.name, c.email, c.phone ?? ""].some((f) => f.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [customers, view, q, location, reason]);

  const day10 = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");

  return (
    <>
      <SectionHead
        title="Customers"
        sub="Every student on one record — see who's unpaid, paused, dropped off or blacklisted"
        right={
          <ExportExcelButton
            rows={filtered}
            filename={`Customers-${view}`}
            sheetName="Customers"
            notes={[`Customers — ${VIEWS.find((v) => v.key === view)?.label ?? view} · ${filtered.length} of ${customers.length}`]}
            columns={[
              { label: "Name", value: (c) => c.name },
              { label: "Email", value: (c) => c.email },
              { label: "Phone", value: (c) => c.phone ?? "" },
              { label: "Location", value: (c) => c.location ?? "" },
              { label: "Status", value: (c) => CUSTOMER_STATUS_LABEL[c.customerStatus] ?? c.customerStatus },
              { label: "Blacklisted", value: (c) => (c.blacklisted ? "Yes" : "No") },
              { label: "Reason", value: (c) => reasonLabel(c.statusReason).replace(/^\S+\s/, "") },
              { label: "Note", value: (c) => c.statusNote ?? "" },
              { label: "Bookings", value: (c) => c.bookings },
              { label: "Classes", value: (c) => c.classes },
              { label: "Paid (SEK)", value: (c) => c.paidTotal },
              { label: "Unpaid (SEK)", value: (c) => c.unpaidAmount },
              { label: "Last booking", value: (c) => day10(c.lastBookingAt) },
              { label: "Customer since", value: (c) => day10(c.createdAt) },
              { label: "GDPR consent", value: (c) => day10(c.gdprConsentAt) || "Not given" },
              { label: "Consent version", value: (c) => c.gdprConsentVersion ?? "" },
              { label: "Contact & booking data", value: (c) => (c.dataConsent ? "Yes" : "No") },
              { label: "Photos", value: (c) => (c.photoConsent ? "Yes" : "No") },
              { label: "Videos", value: (c) => (c.videoConsent ? "Yes" : "No") },
              { label: "Promotional use", value: (c) => (c.promoConsent ? "Yes" : "No") },
            ]}
          />
        }
      />

      {/* Bulk import — the list refreshes itself once it's done */}
      {canEdit && <StudentImportCard onImported={load} />}

      {/* Status tiles double as the quick filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              setView(v.key);
              setReason("");
            }}
            className={`stat text-left transition-all ${view === v.key ? "!border-brand-500 ring-2 ring-brand-500/30" : "hover:!border-brand-400/60"}`}
          >
            <div className="stat-label">
              {v.icon} {v.label}
            </div>
            <div className={`stat-value ${v.tone}`}>{loading ? "—" : counts[v.key]}</div>
            <div className="stat-sub">{v.key === "unpaid" && unpaidTotal > 0 ? `${sek(unpaidTotal)} owed` : v.sub}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
            <div className="flex min-w-[200px] flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
              <span className="text-sm">🔍</span>
              <input
                className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none"
                placeholder="Search name, email, phone…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select className="field w-auto min-w-[140px] flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select className="field w-auto min-w-[160px] flex-1 px-2 py-2 text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Any reason</option>
              <optgroup label="Pause / drop-off">
                {DROP_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Blacklist">
                {BLACKLIST_REASONS.filter((r) => r.code !== "other").map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Bookings</th>
                    <th>Paid</th>
                    <th>Last booking</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        Loading customers…
                      </td>
                    </tr>
                  )}
                  {!loading && loadError && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-semibold text-danger">
                        {loadError}
                      </td>
                    </tr>
                  )}
                  {!loading && !loadError && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-14 text-center">
                        <div className="text-3xl">🗂️</div>
                        <div className="mt-2 font-bold text-ink">{customers.length ? "No matches" : "No customers yet"}</div>
                        <div className="mt-1 text-[13px] text-muted">
                          {customers.length ? "Try another status tile or clear the search." : "Students appear here once they sign up or book."}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setDetailId(c.id)}>
                          <Avatar letter={(c.name[0] || "?").toUpperCase()} size={28} />
                          <div className="min-w-0">
                            <div className="font-bold text-ink hover:text-brand-600">{c.name}</div>
                            <div className="text-[11px] text-muted">
                              {c.email}
                              {c.phone ? ` · ${c.phone}` : ""}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="whitespace-nowrap text-[12px]">
                        {c.location ? `${c.flag ?? ""} ${c.location}` : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <StatusTags c={c} />
                      </td>
                      <td className="max-w-[180px] text-[12px]">
                        {c.statusReason ? (
                          <>
                            <div className="font-semibold text-ink">{reasonLabel(c.statusReason)}</div>
                            {c.statusChangedAt && <div className="text-[10px] text-muted">since {day(c.statusChangedAt)}</div>}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-[12px]">
                        <span className="font-bold text-ink">{c.bookings}</span>
                        {c.classes > 0 && <span className="text-muted"> · {c.classes} class</span>}
                      </td>
                      <td className="whitespace-nowrap text-[12px] font-semibold text-ink">{c.paidTotal ? sek(c.paidTotal) : "—"}</td>
                      <td className="whitespace-nowrap text-[12px]">{day(c.lastBookingAt)}</td>
                      <td>
                        <div className="flex flex-nowrap gap-1">
                          <button className="btn btn-ghost btn-sm" title="View history" onClick={() => setDetailId(c.id)}>
                            👁
                          </button>
                          {canEdit && <RowActions c={c} onAction={(a) => setAction({ customer: c, action: a })} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-2 text-[12px] text-muted">
            Showing {filtered.length} of {customers.length} customers
          </div>
        </div>

        <ReasonsPanel reasons={reasons} onPick={(code) => { setReason(code); setView("all"); }} />
      </div>

      {detailId && (
        <CustomerDrawer
          id={detailId}
          canEdit={canEdit}
          onClose={() => setDetailId(null)}
          onAction={(c, a) => setAction({ customer: c, action: a })}
          refreshKey={customers}
        />
      )}

      {action && (
        <ActionModal
          customer={action.customer}
          action={action.action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            load();
          }}
        />
      )}
    </>
  );
}

function StatusTags({ c }: { c: Customer }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className={`badge ${STATUS_TONE[c.customerStatus] ?? "badge-gray"}`}>{CUSTOMER_STATUS_LABEL[c.customerStatus] ?? c.customerStatus}</span>
      {c.blacklisted && <span className="badge badge-danger">⛔ Blacklisted</span>}
      {c.unpaidCount > 0 && (
        <span className="badge badge-danger" title={`${c.unpaidCount} unpaid booking(s)`}>
          💸 Unpaid {sek(c.unpaidAmount)}
        </span>
      )}
    </div>
  );
}

function RowActions({ c, onAction }: { c: Customer; onAction: (a: CustomerAction) => void }) {
  return (
    <>
      {c.customerStatus === "active" ? (
        <>
          <button className="btn btn-ghost btn-sm" title="Pause" onClick={() => onAction("paused")}>
            ⏸️
          </button>
          <button className="btn btn-ghost btn-sm" title="Mark as dropped off" onClick={() => onAction("dropped")}>
            📉
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-sm" title="Resume — keeps all their history" onClick={() => onAction("resumed")}>
          ▶️ Resume
        </button>
      )}
      {c.blacklisted ? (
        <button className="btn btn-ghost btn-sm" title="Remove from blacklist" onClick={() => onAction("unblacklisted")}>
          ✅
        </button>
      ) : (
        <button className="btn btn-ghost btn-sm" title="Blacklist" onClick={() => onAction("blacklisted")}>
          ⛔
        </button>
      )}
    </>
  );
}

/** How often each reason was given — the pattern the sales team asked for. */
function ReasonsPanel({ reasons, onPick }: { reasons: ReasonStat[]; onPick: (code: string) => void }) {
  const rows = useMemo(() => {
    const map = new Map<string, { paused: number; dropped: number }>();
    for (const r of reasons) {
      if (!r.reasonCode) continue;
      const e = map.get(r.reasonCode) ?? { paused: 0, dropped: 0 };
      if (r.action === "paused") e.paused += r.count;
      else e.dropped += r.count;
      map.set(r.reasonCode, e);
    }
    return Array.from(map, ([code, v]) => ({ code, ...v, total: v.paused + v.dropped })).sort((a, b) => b.total - a.total);
  }, [reasons]);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="h-fit rounded-xl border border-line/70 bg-white p-4 shadow-card">
      <div className="font-display text-[15px] font-bold text-ink">Why customers leave</div>
      <div className="mb-3 text-[11px] text-muted">Every pause & drop-off reason ever recorded</div>
      {rows.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-line py-6 text-center text-[12px] text-muted">
          No reasons recorded yet. They appear here when a customer is paused or marked as dropped off.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <button key={r.code} type="button" className="text-left" onClick={() => onPick(r.code)} title="Show customers with this reason">
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-semibold text-ink">{reasonLabel(r.code)}</span>
                <span className="font-bold text-ink">{r.total}</span>
              </div>
              <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-line/50">
                {r.dropped > 0 && <div className="h-full rounded-full bg-slate" style={{ width: `${(r.dropped / max) * 100}%` }} />}
                {r.paused > 0 && <div className="h-full rounded-full bg-warn" style={{ width: `${(r.paused / max) * 100}%` }} />}
              </div>
            </button>
          ))}
          <div className="mt-1 flex gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate" /> Dropped off
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-warn" /> Paused
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerDrawer({
  id,
  canEdit,
  onClose,
  onAction,
  refreshKey,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onAction: (c: Customer, a: CustomerAction) => void;
  refreshKey: unknown;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/customers/${id}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return;
        if (!ok) setError(j.error || "Couldn't load this customer");
        else setD(j.data);
      })
      .catch(() => alive && setError("Couldn't load this customer"));
    return () => {
      alive = false;
    };
  }, [id, refreshKey]);

  const unpaid = d?.bookings.filter((b) => b.unpaid) ?? [];
  const paidTotal = d?.bookings.filter((b) => b.paid === "paid").reduce((s, b) => s + b.amount, 0) ?? 0;
  const summary: Customer | null = d
    ? {
        ...d,
        bookings: d.bookings.length,
        classes: d.bookings.filter((b) => b.type === "class").length,
        paidTotal,
        unpaidCount: unpaid.length,
        unpaidAmount: unpaid.reduce((s, b) => s + b.amount, 0),
        lastBookingAt: d.bookings[0]?.createdAt ?? null,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/45" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-pop animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar letter={(d?.name[0] || "?").toUpperCase()} size={44} />
            <div>
              <div className="font-display text-lg font-bold text-ink">{d?.name ?? "Loading…"}</div>
              {d && (
                <div className="text-[12px] text-muted">
                  {d.email}
                  {d.phone ? ` · ${d.phone}` : ""}
                </div>
              )}
            </div>
          </div>
          <button type="button" className="text-2xl leading-none text-muted" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

        {d && summary && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusTags c={summary} />
              {d.statusReason && <span className="text-[12px] text-slate">· {reasonLabel(d.statusReason)}</span>}
            </div>
            {d.statusNote && <div className="mb-4 rounded-lg bg-cream/60 p-3 text-[12px] text-slate">📝 {d.statusNote}</div>}

            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MiniStat label="Customer since" value={day(d.createdAt)} />
              <MiniStat label="Bookings" value={String(summary.bookings)} />
              <MiniStat label="Paid in total" value={sek(paidTotal)} />
              <MiniStat label="Unpaid" value={summary.unpaidAmount ? sek(summary.unpaidAmount) : "—"} danger={summary.unpaidAmount > 0} />
            </div>

            {/* GDPR: each permission on its own, so it's clear what may be used. */}
            <div className="mb-5 rounded-lg border border-line bg-cream/40 p-3 text-[12px]">
              <div className="mb-1 font-semibold text-ink">🔒 Privacy &amp; GDPR consent</div>
              {d.gdprConsentAt ? (
                <div className="text-slate">
                  Last updated {day(d.gdprConsentAt)}
                  {d.gdprConsentVersion ? ` · wording ${d.gdprConsentVersion}` : ""}
                </div>
              ) : (
                <div className="font-semibold text-danger">Not given yet — they&apos;ll be asked at their next booking.</div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <ConsentTag label="Contact & booking data" on={d.dataConsent} />
                <ConsentTag label="Photos" on={d.photoConsent} />
                <ConsentTag label="Videos" on={d.videoConsent} />
                <ConsentTag label="Promotional use" on={d.promoConsent} />
              </div>
              {!d.photoConsent && !d.videoConsent && (
                <div className="mt-1.5 font-semibold text-danger">
                  No photos or videos of this customer may be used
                  {d.mediaConsentWithdrawnAt ? ` (withdrawn ${day(d.mediaConsentWithdrawnAt)})` : ""}.
                </div>
              )}
            </div>

            {canEdit && (
              <div className="mb-5 flex flex-wrap gap-2">
                {d.customerStatus !== "active" && (
                  <button className="btn btn-primary btn-sm" onClick={() => onAction(summary, "resumed")}>
                    ▶️ Resume customer
                  </button>
                )}
                {d.customerStatus === "active" && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => onAction(summary, "paused")}>
                      ⏸️ Pause
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => onAction(summary, "dropped")}>
                      📉 Mark dropped off
                    </button>
                  </>
                )}
                {d.blacklisted ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => onAction(summary, "unblacklisted")}>
                    ✅ Remove from blacklist
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => onAction(summary, "blacklisted")}>
                    ⛔ Blacklist
                  </button>
                )}
                {!d.blacklisted && (
                  <Link href={`/admin/book-on-behalf?email=${encodeURIComponent(d.email)}`} className="btn btn-ghost btn-sm no-underline">
                    ✏️ Book a class for them
                  </Link>
                )}
              </div>
            )}

            <div className="mb-2 font-display text-[15px] font-bold text-ink">Bookings & payments</div>
            <div className="mb-5 overflow-x-auto rounded-lg border-[1.5px] border-line">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-cream/60 text-[10px] uppercase tracking-wide text-slate">
                  <tr>
                    <th className="px-3 py-2">Booking</th>
                    <th className="px-3 py-2">What</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bookings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-muted">
                        No bookings yet.
                      </td>
                    </tr>
                  )}
                  {d.bookings.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold text-ink">{b.id}</div>
                        <div className="text-[10px] text-muted">{day(b.createdAt)}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-ink">
                          {TYPE_LABEL[b.type] ?? b.type} · {b.detail}
                        </div>
                        <div className="text-[10px] text-muted">
                          {[b.period, b.plan, b.location].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">
                        <div className="font-semibold text-ink">{sek(b.amount)}</div>
                        {b.unpaid ? (
                          <span className="badge badge-danger">Unpaid</span>
                        ) : b.paid === "paid" ? (
                          <>
                            <span className="text-[10px] font-semibold text-ok">✓ Paid</span>
                            {b.amount > 0 && (
                              <a
                                href={`/api/invoices/${encodeURIComponent(b.id)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 text-[10px] font-semibold text-brand-600 hover:underline"
                              >
                                🧾 Invoice
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-muted">{b.paid === "onetime" ? "Waived" : b.paid}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={`badge ${toneClass[b.statusTone] ?? "badge-gray"}`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-2 font-display text-[15px] font-bold text-ink">Status history</div>
            {d.history.length === 0 ? (
              <div className="rounded-lg border-[1.5px] border-dashed border-line py-5 text-center text-[12px] text-muted">
                No status changes yet — this customer has always been active.
              </div>
            ) : (
              <ol className="relative ml-2 border-l-2 border-line pl-4">
                {d.history.map((h) => (
                  <li key={h.id} className="mb-3">
                    <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                    <div className="text-[13px] font-bold text-ink">{ACTION_LABEL[h.action] ?? h.action}</div>
                    {h.reasonCode && <div className="text-[12px] text-slate">{reasonLabel(h.reasonCode)}</div>}
                    {h.note && <div className="text-[12px] text-slate">📝 {h.note}</div>}
                    <div className="text-[10px] text-muted">
                      {new Date(h.createdAt).toLocaleString("en-GB")} · {h.actorName ?? "Automatic"}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border-[1.5px] border-line bg-cream/40 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-[14px] font-bold ${danger ? "text-danger" : "text-ink"}`}>{value}</div>
    </div>
  );
}

/** One GDPR permission, green when allowed and red when not. */
function ConsentTag({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        on ? "bg-ok/15 text-ok" : "bg-danger/10 text-danger"
      }`}
    >
      {on ? "✓" : "✕"} {label}
    </span>
  );
}

const ACTION_COPY: Record<CustomerAction, { title: string; button: string; help: string }> = {
  paused: {
    title: "Pause customer",
    button: "⏸️ Pause",
    help: "They're taking a break. Everything stays on their record, and they're switched back to active automatically when they book again.",
  },
  dropped: {
    title: "Mark as dropped off",
    button: "📉 Mark dropped off",
    help: "They've stopped coming. The reason helps spot patterns (pricing, timing, instructor…). If they come back, their history is still here.",
  },
  resumed: {
    title: "Resume customer",
    button: "▶️ Resume",
    help: "They're back on their original record — attendance, payments and bookings stay linked. No new profile is created.",
  },
  blacklisted: {
    title: "Blacklist customer",
    button: "⛔ Blacklist",
    help: "They won't be able to book online, and admins can't book for them until they're removed from the blacklist.",
  },
  unblacklisted: {
    title: "Remove from blacklist",
    button: "✅ Remove from blacklist",
    help: "They'll be able to book again straight away.",
  },
};

function ActionModal({
  customer,
  action,
  onClose,
  onDone,
}: {
  customer: Customer;
  action: CustomerAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const needsReason = action === "paused" || action === "dropped" || action === "blacklisted";
  const reasons = action === "blacklisted" ? BLACKLIST_REASONS : DROP_REASONS;
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = ACTION_COPY[action];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsReason && !reasonCode) {
      setError("Choose a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reasonCode: needsReason ? reasonCode : null, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between">
          <div className="font-display text-lg font-bold text-ink">{copy.title}</div>
          <button type="button" className="text-xl leading-none text-muted" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mb-3 text-[13px] font-semibold text-ink">
          {customer.name} <span className="font-normal text-muted">· {customer.email}</span>
        </div>
        <p className="mb-4 rounded-lg bg-cream/60 p-3 text-[12px] text-slate">{copy.help}</p>

        {action === "resumed" && customer.statusReason && (
          <p className="mb-3 text-[12px] text-slate">
            Was {CUSTOMER_STATUS_LABEL[customer.customerStatus]?.toLowerCase()} because: <strong>{reasonLabel(customer.statusReason)}</strong>
          </p>
        )}

        {needsReason && (
          <>
            <label className="field-label">Reason *</label>
            <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {reasons.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setReasonCode(r.code)}
                  className={`rounded-lg border-[1.5px] px-2.5 py-2 text-left text-[12px] font-semibold transition-all ${
                    reasonCode === r.code ? "border-brand-500 bg-brand-50 text-ink" : "border-line text-slate hover:border-brand-400/60"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="field-label">Note {action === "resumed" || action === "unblacklisted" ? "(optional)" : "(optional — any details)"}</label>
        <textarea
          className="field min-h-[70px]"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={action === "resumed" ? "e.g. Back after summer, wants the evening batch" : "e.g. Moving to Gothenburg in October"}
        />

        {error && <div className="mt-3 text-xs font-semibold text-danger">{error}</div>}
        <div className="mt-4 flex justify-between">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`btn ${action === "blacklisted" ? "btn-danger" : "btn-primary"} ${busy ? "is-disabled" : ""}`} disabled={busy}>
            {busy ? "Saving…" : copy.button}
          </button>
        </div>
      </form>
    </div>
  );
}
