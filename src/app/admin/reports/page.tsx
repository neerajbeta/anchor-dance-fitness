"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import type { Registration } from "@/lib/data";

type Bucket = { label: string; count: number };
type Loc = { id: string; label: string; flag: string | null };

type FullReport = {
  connected: boolean;
  kpis: {
    totalRegistrations: number;
    revenue: number;
    overdue: number;
    classBookings: number;
    workshopEventBookings: number;
    studioBookings: number;
    activeClasses: number;
    activeEvents: number;
    activeDiscounts: number;
    activeStudioBlocks: number;
  };
  byCategory: Bucket[];
  byLocation: Bucket[];
  byType: Bucket[];
  byPlan: Bucket[];
  rows: Registration[];
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return d.toISOString().slice(0, 7);
});

const EMPTY: FullReport = {
  connected: false,
  kpis: {
    totalRegistrations: 0,
    revenue: 0,
    overdue: 0,
    classBookings: 0,
    workshopEventBookings: 0,
    studioBookings: 0,
    activeClasses: 0,
    activeEvents: 0,
    activeDiscounts: 0,
    activeStudioBlocks: 0,
  },
  byCategory: [],
  byLocation: [],
  byType: [],
  byPlan: [],
  rows: [],
};

export default function ReportsPage() {
  const [month, setMonth] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [locs, setLocs] = useState<Loc[]>([]);
  const [report, setReport] = useState<FullReport>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocs(j.data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (location) qs.set("location", location);
    if (type) qs.set("type", type);
    fetch(`/api/reports/summary?${qs}`)
      .then((r) => r.json())
      .then((j) => setReport(j.data ?? EMPTY))
      .finally(() => setLoading(false));
  }, [month, location, type]);

  const k = report.kpis;

  return (
    <AdminShell>
      <SectionHead
        title="Reports"
        sub="Every admin feature in one view — registrations, classes, events, studio, payments & discounts"
        right={
          report.connected ? (
            <span className="badge badge-ok" title="Reading from PostgreSQL">
              ● Live database
            </span>
          ) : (
            <span className="badge badge-warn">● Sample data</span>
          )
        }
      />

      {/* Filters — one place for the whole report */}
      <div className="mb-5 flex flex-nowrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Month</span>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All time</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Location</span>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locs.map((l) => (
            <option key={l.id} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Type</span>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="class">💃 Class</option>
          <option value="workshop">🎭 Workshop / Event</option>
          <option value="studio">🏛️ Studio</option>
        </select>
        {(month || location || type) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMonth("");
              setLocation("");
              setType("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-muted">Loading report…</div>
      ) : (
        <>
          {/* KPIs — every feature area */}
          <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            <Stat label="Total Registrations" value={String(k.totalRegistrations)} sub="Matching filters" />
            <Stat label="Revenue" value={`SEK ${k.revenue.toLocaleString()}`} sub="Confirmed payments" />
            <Stat label="Overdue" value={String(k.overdue)} tone="!text-danger" sub="Payment overdue" />
            <Stat label="Active Classes" value={String(k.activeClasses)} sub="In Classes catalog" />
            <Stat label="Active Events" value={String(k.activeEvents)} sub="Upcoming workshops/events" />
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            <Stat label="Class Bookings" value={String(k.classBookings)} sub="This filter" />
            <Stat label="Workshop/Event Bookings" value={String(k.workshopEventBookings)} sub="This filter" />
            <Stat label="Studio Bookings" value={String(k.studioBookings)} sub="This filter" />
            <Stat label="Active Discounts" value={String(k.activeDiscounts)} sub="Discount Master" />
            <Stat label="Blocked Studio Slots" value={String(k.activeStudioBlocks)} sub="Studio Bookings" />
          </div>

          {/* Breakdowns — 4 features side by side */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BreakdownCard title="🏆 By Category" data={report.byCategory} />
            <BreakdownCard title="📍 By Location" data={report.byLocation} />
            <BreakdownCard title="🎫 By Booking Type" data={report.byType} />
            <BreakdownCard title="💳 By Plan" data={report.byPlan} />
          </div>

          {/* Detail table — filtered registrations across every type */}
          <div className="card">
            <div className="card-title">📋 Registrations (filtered)</div>
            {report.rows.length === 0 ? (
              <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-10 text-center text-[13px] text-muted">
                No registrations match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="dt">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="text-[11px] text-muted">{r.id}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar letter={r.initial} color={r.color} size={24} /> {r.name}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {r.flag} {r.location}
                        </td>
                        <td className="capitalize">{r.type}</td>
                        <td className="text-[12px]">{r.category ?? "—"}</td>
                        <td>
                          <span className="badge badge-gray">{r.plan}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="font-semibold text-ink">SEK {(r.amount ?? 0).toLocaleString()}</span>
                          {r.discountCode && (
                            <div className="text-[10px] font-semibold text-ok">🏷️ {r.discountCode}</div>
                          )}
                        </td>
                        <td>
                          {r.paid === "overdue" ? (
                            <span className="badge badge-danger">✗ Overdue</span>
                          ) : (
                            <span className="badge badge-ok">✓ Paid</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${toneClass[r.statusTone] ?? "badge-gray"}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Bucket[] }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {data.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
          No data for this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.slice(0, 8).map((d) => (
            <div key={d.label}>
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">{d.label}</span>
                <span className="font-bold text-brand-600">{d.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.count / max) * 100}%`,
                    background: "linear-gradient(90deg,#F7942E,#E63E2B)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
