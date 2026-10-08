"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Stage = "converted" | "upcoming" | "follow_up" | "cancelled";
type Trial = {
  id: string;
  name: string;
  email: string;
  location: string;
  category: string | null;
  level: string | null;
  detail: string | null;
  mode: string | null;
  trialDate: string | null;
  bookedAt: string | null;
  paid: string;
  stage: Stage;
  convertedBooking: { id: string; plan: string | null; amount: number; at: string | null; detail: string | null } | null;
  daysToConvert: number | null;
};
type Request = {
  id: string;
  name: string;
  email: string;
  phone: string;
  interest: string | null;
  typeOfClass: string | null;
  location: string | null;
  status: string;
  createdAt: string | null;
  alreadyBooked: boolean;
};

const STAGE: Record<Stage, { label: string; tone: string }> = {
  converted: { label: "✅ Converted", tone: "badge-ok" },
  upcoming: { label: "📅 Upcoming", tone: "badge-info" },
  follow_up: { label: "📞 Follow up", tone: "badge-warn" },
  cancelled: { label: "✗ Cancelled", tone: "badge-gray" },
};

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function TrialsClient() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"trials" | "requests">("trials");
  const [stage, setStage] = useState<Stage | "">("");
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/trials", { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Couldn't load trials");
        setTrials(j.data.trials);
        setRequests(j.data.requests);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load trials"))
      .finally(() => setLoading(false));
  }, []);

  const valid = trials.filter((t) => t.stage !== "cancelled");
  const decided = valid.filter((t) => t.stage !== "upcoming");
  const converted = valid.filter((t) => t.stage === "converted");
  const rate = decided.length ? Math.round((converted.length / decided.length) * 100) : 0;
  const days = converted.map((t) => t.daysToConvert).filter((n): n is number => n != null);
  const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
  const followUps = valid.filter((t) => t.stage === "follow_up").length;
  const openRequests = requests.filter((r) => !r.alreadyBooked).length;

  const locations = useMemo(() => Array.from(new Set(trials.map((t) => t.location))).sort(), [trials]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return trials.filter(
      (t) =>
        (!stage || t.stage === stage) &&
        (!location || t.location === location) &&
        (!term || [t.name, t.email, t.detail ?? "", t.category ?? ""].some((f) => f.toLowerCase().includes(term)))
    );
  }, [trials, stage, location, q]);

  // Conversion by category — which classes turn trials into students.
  const byCategory = useMemo(() => {
    const m = new Map<string, { total: number; converted: number }>();
    for (const t of decided) {
      const k = t.category || "Other";
      const e = m.get(k) ?? { total: 0, converted: 0 };
      e.total++;
      if (t.stage === "converted") e.converted++;
      m.set(k, e);
    }
    return Array.from(m, ([k, v]) => ({ k, ...v, pct: Math.round((v.converted / v.total) * 100) })).sort((a, b) => b.total - a.total);
  }, [decided]);

  return (
    <>
      <SectionHead
        title="Trial Sessions"
        sub="Who has had a trial, when, and whether it turned into a paid enrolment"
        right={
          tab === "requests" ? (
            <ExportExcelButton
              rows={requests}
              filename="Trial-requests"
              sheetName="Trial requests"
              notes={[`Trial requests — ${requests.length}`]}
              columns={[
                { label: "Name", value: (r) => r.name },
                { label: "Email", value: (r) => r.email },
                { label: "Phone", value: (r) => r.phone },
                { label: "Area of interest", value: (r) => r.interest ?? "" },
                { label: "Type of class", value: (r) => r.typeOfClass ?? "" },
                { label: "Location", value: (r) => r.location ?? "" },
                { label: "Status", value: (r) => r.status },
                { label: "Trial booked", value: (r) => (r.alreadyBooked ? "Yes" : "No") },
                { label: "Requested", value: (r) => r.createdAt?.slice(0, 10) ?? "" },
              ]}
            />
          ) : (
            <ExportExcelButton
              rows={shown}
              filename="Trial-sessions"
              sheetName="Trials"
              notes={[`Trial sessions — ${shown.length} of ${trials.length}`]}
              columns={[
                { label: "Booking ID", value: (t) => t.id },
                { label: "Name", value: (t) => t.name },
                { label: "Email", value: (t) => t.email },
                { label: "Trial date", value: (t) => t.trialDate ?? "" },
                { label: "Class", value: (t) => t.detail ?? "" },
                { label: "Category", value: (t) => t.category ?? "" },
                { label: "Level", value: (t) => t.level ?? "" },
                { label: "Mode", value: (t) => t.mode ?? "" },
                { label: "Location", value: (t) => t.location },
                { label: "Payment", value: (t) => t.paid },
                { label: "Stage", value: (t) => STAGE[t.stage]?.label.replace(/^\S+\s/, "") ?? t.stage },
                { label: "Converted to", value: (t) => t.convertedBooking?.plan ?? "" },
                { label: "Converted amount (SEK)", value: (t) => t.convertedBooking?.amount ?? "" },
                { label: "Days to convert", value: (t) => t.daysToConvert ?? "" },
                { label: "Booked at", value: (t) => t.bookedAt?.slice(0, 10) ?? "" },
              ]}
            />
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="🎯 Trials booked" value={loading ? "—" : String(valid.length)} sub="All time, not cancelled" onClick={() => { setTab("trials"); setStage(""); }} />
        <Tile label="✅ Converted" value={loading ? "—" : String(converted.length)} sub="Went on to a paid plan" tone="!text-ok" onClick={() => { setTab("trials"); setStage("converted"); }} active={tab === "trials" && stage === "converted"} />
        <Tile label="📈 Conversion rate" value={loading ? "—" : `${rate}%`} sub={avgDays != null ? `Avg ${avgDays} day${avgDays === 1 ? "" : "s"} to convert` : "Of trials already taken"} />
        <Tile label="📞 Needs follow-up" value={loading ? "—" : String(followUps)} sub="Trial done, not enrolled yet" tone="!text-warn" onClick={() => { setTab("trials"); setStage("follow_up"); }} active={tab === "trials" && stage === "follow_up"} />
        <Tile label="📨 Trial requests" value={loading ? "—" : String(openRequests)} sub="'Book a Demo' — not booked yet" onClick={() => setTab("requests")} active={tab === "requests"} />
      </div>

      {error && <div className="mb-3 rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

      <div className="mb-3 flex gap-1">
        <button className={`btn btn-sm ${tab === "trials" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("trials")}>
          Trials ({trials.length})
        </button>
        <button className={`btn btn-sm ${tab === "requests" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("requests")}>
          Requests ({requests.length})
        </button>
      </div>

      {tab === "trials" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
              <div className="flex min-w-[200px] flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
                <span className="text-sm">🔍</span>
                <input className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none" placeholder="Search name, email, class…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="field w-auto min-w-[140px] flex-1 px-2 py-2 text-xs" value={stage} onChange={(e) => setStage(e.target.value as Stage | "")}>
                <option value="">Any outcome</option>
                {(Object.keys(STAGE) as Stage[]).map((s) => (
                  <option key={s} value={s}>
                    {STAGE[s].label}
                  </option>
                ))}
              </select>
              <select className="field w-auto min-w-[140px] flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Trial</th>
                      <th>Trial date</th>
                      <th>Outcome</th>
                      <th>Converted to</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loading && shown.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="text-3xl">🎯</div>
                          <div className="mt-2 font-bold text-ink">{trials.length ? "No matches" : "No trials yet"}</div>
                          <div className="mt-1 text-[13px] text-muted">
                            {trials.length ? "Try another filter." : "Book a trial with the Demo plan in Book on Behalf — it will show up here."}
                          </div>
                        </td>
                      </tr>
                    )}
                    {shown.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar letter={(t.name[0] || "?").toUpperCase()} size={26} />
                            <div>
                              <div className="font-bold text-ink">{t.name}</div>
                              <div className="text-[11px] text-muted">{t.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[200px] text-[12px]">
                          <div className="text-ink">{t.detail || "—"}</div>
                          <div className="text-[10px] text-muted">{[t.category, t.level, t.location].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="whitespace-nowrap text-[12px]">
                          {day(t.trialDate)}
                          <div className="text-[10px] text-muted">booked {day(t.bookedAt)} · {t.id}</div>
                        </td>
                        <td>
                          <span className={`badge ${STAGE[t.stage].tone}`}>{STAGE[t.stage].label}</span>
                        </td>
                        <td className="text-[12px]">
                          {t.convertedBooking ? (
                            <>
                              <div className="font-semibold text-ink">
                                {t.convertedBooking.plan} · SEK {t.convertedBooking.amount.toLocaleString("sv-SE")}
                              </div>
                              <div className="text-[10px] text-muted">
                                {day(t.convertedBooking.at)}
                                {t.daysToConvert != null ? ` · after ${t.daysToConvert} day${t.daysToConvert === 1 ? "" : "s"}` : ""}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {t.stage === "follow_up" || t.stage === "upcoming" ? (
                            <div className="flex gap-1">
                              <Link className="btn btn-primary btn-sm no-underline" href={`/admin/book-on-behalf?email=${encodeURIComponent(t.email)}&name=${encodeURIComponent(t.name)}`} title="Enrol on a regular plan">
                                Enrol
                              </Link>
                              <a className="btn btn-ghost btn-sm no-underline" href={`mailto:${t.email}?subject=${encodeURIComponent("How was your trial class?")}`} title="Email them">
                                ✉️
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="h-fit rounded-xl border border-line/70 bg-white p-4 shadow-card">
            <div className="font-display text-[15px] font-bold text-ink">Conversion by class type</div>
            <div className="mb-3 text-[11px] text-muted">Trials already taken, by category</div>
            {byCategory.length === 0 ? (
              <div className="rounded-lg border-[1.5px] border-dashed border-line py-6 text-center text-[12px] text-muted">No completed trials yet.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {byCategory.map((c) => (
                  <div key={c.k}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-ink">{c.k}</span>
                      <span className="text-muted">
                        <strong className="text-ink">{c.pct}%</strong> · {c.converted}/{c.total}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-line/60">
                      <div className="h-full rounded-full bg-ok" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>Requested by</th>
                  <th>Interested in</th>
                  <th>Location</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      No open trial requests. New &quot;Book a Demo&quot; submissions appear here until a trial is booked.
                    </td>
                  </tr>
                )}
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-bold text-ink">{r.name}</div>
                      <div className="text-[11px] text-muted">
                        {r.email} · {r.phone}
                      </div>
                    </td>
                    <td className="text-[12px]">
                      {r.interest || "—"}
                      {r.typeOfClass && <div className="text-[10px] text-muted">{r.typeOfClass}</div>}
                    </td>
                    <td className="text-[12px]">{r.location || "—"}</td>
                    <td className="whitespace-nowrap text-[12px]">{day(r.createdAt)}</td>
                    <td>
                      <span className={`badge ${r.status === "new" ? "badge-brand" : "badge-info"}`}>{r.status === "new" ? "New" : "Contacted"}</span>
                      {r.alreadyBooked && <div className="mt-1 text-[10px] font-semibold text-ok">Has booked a class</div>}
                    </td>
                    <td>
                      <Link
                        className="btn btn-primary btn-sm no-underline"
                        href={`/admin/book-on-behalf?email=${encodeURIComponent(r.email)}&name=${encodeURIComponent(r.name)}&trial=1`}
                      >
                        🎯 Book trial
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, sub, tone = "", onClick, active }: { label: string; value: string; sub: string; tone?: string; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`stat text-left ${active ? "!border-brand-500 ring-2 ring-brand-500/30" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </Tag>
  );
}
