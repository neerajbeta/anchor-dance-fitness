"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead } from "@/components/ui";
import type { Registration } from "@/lib/data";
import type { PaymentStats } from "@/lib/stats";

export function PaymentsClient({ stats }: { stats: PaymentStats }) {
  const rows = stats.rows;
  const [payment, setPayment] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [locOpts, setLocOpts] = useState<{ id: string; label: string; flag: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocOpts(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r: Registration) => {
      if (payment === "paid" && r.paid === "overdue") return false;
      if (payment === "overdue" && r.paid !== "overdue") return false;
      if (type === "class" && r.type !== "class") return false;
      if (type === "we" && r.type !== "workshop" && r.type !== "event") return false;
      if (type === "studio" && r.type !== "studio") return false;
      if (location && r.location !== location) return false;
      if (term && ![r.name, r.id, r.email].some((f) => f.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, payment, type, location, q]);

  return (
    <AdminShell>
      <SectionHead
        title="Payment Dashboard"
        sub="Classes · Workshops / Events · Studio"
        right={
          <div className="flex items-center gap-2">
            {stats.connected ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <button className="btn btn-ghost btn-sm">📥 Export</button>
            <button className="btn btn-primary btn-sm">📩 Bulk Reminders</button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Paid This Month" value={String(stats.paidThisMonth)} tone="!text-ok" />
        <Stat label="Overdue" value={String(stats.overdue)} tone="!text-danger" />
        <Stat label="Due in 7 Days" value={String(stats.dueSoon)} tone="!text-warn" />
        <Stat label="Total Revenue" value={`SEK ${stats.revenue.toLocaleString()}`} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
        <div className="flex min-w-0 flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
          <span className="text-sm">🔍</span>
          <input
            className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none"
            placeholder="Search name, ID, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="">All Payments</option>
          <option value="paid">✓ Paid</option>
          <option value="overdue">✗ Overdue</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="class">Class</option>
          <option value="we">Workshop/Event</option>
          <option value="studio">Studio</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locOpts.map((l) => (
            <option key={l.id} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>ID</th>
                <th>Student</th>
                <th>Location</th>
                <th>Type</th>
                <th>Category</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="text-3xl">💳</div>
                    <div className="mt-2 font-bold text-ink">
                      {rows.length === 0 ? "No payments yet" : "No matches"}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {rows.length === 0
                        ? "Payments appear here as students complete bookings."
                        : "Try clearing the filters."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[11px] text-muted">{r.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar letter={r.initial} color={r.color} size={26} /> {r.name}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 text-right text-[13px] text-muted">
        Showing {filtered.length} of {rows.length}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
