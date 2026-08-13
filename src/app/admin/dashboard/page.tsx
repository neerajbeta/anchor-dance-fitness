import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { LocTabs } from "@/components/LocTabs";
import { getDashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const s = await getDashboardStats();

  return (
    <AdminShell>
      <SectionHead
        title="Dashboard"
        sub="Live overview · All locations"
        right={
          s.connected ? (
            <span className="badge badge-ok" title="Reading from PostgreSQL">
              ● Live database
            </span>
          ) : (
            <span className="badge badge-warn">● Sample data</span>
          )
        }
      />
      <LocTabs />

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Total Students" value={String(s.totalStudents)} sub="Registered students" />
        <Kpi
          label="Active Class Enrollments"
          value={String(s.classEnrollments)}
          sub={`${s.pendingBatch} pending batch`}
        />
        <Kpi label="Revenue" value={`SEK ${s.revenue.toLocaleString()}`} sub="Confirmed payments" />
        <Kpi label="Overdue Payments" value={String(s.overdue)} sub="Reminders pending" danger />
      </div>

      {/* Booking type breakdown */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <BreakCard color="#3B82C4" title="💃 Classes" value={String(s.classes)} sub="Class Bookings" />
        <BreakCard
          color="#E0972B"
          title="🎭 Workshops & Events"
          value={String(s.workshops)}
          sub="Upcoming Published"
        />
        <BreakCard
          color="#8B5CF6"
          title="🏛️ Studio Bookings"
          value={String(s.studio)}
          sub="Studio Bookings"
        />
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="card-title mb-0">🆕 New Registrations</div>
            <Link href="/admin/registrations" className="btn btn-primary btn-sm">
              View All →
            </Link>
          </div>
          {s.newRegistrations.length === 0 ? (
            <EmptyRow text="No registrations yet — new sign-ups will appear here." />
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.newRegistrations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar letter={r.initial} color={r.color} size={26} /> {r.name}
                      </div>
                    </td>
                    <td className="capitalize">{r.type}</td>
                    <td className="text-[12px]">{r.category ?? "—"}</td>
                    <td>
                      <span className={`badge ${toneClass[r.statusTone]}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="card-title mb-0">⚠️ Payment Alerts</div>
            <button className="btn btn-primary btn-sm">Send All Reminders</button>
          </div>
          {s.paymentAlerts.length === 0 ? (
            <EmptyRow text="No overdue payments 🎉" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {s.paymentAlerts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-danger/5 p-2.5"
                >
                  <div>
                    <div className="text-[13px] font-bold text-ink">{r.name}</div>
                    <div className="text-[11px] text-muted">{r.period}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-danger">Overdue</span>
                    <button className="btn btn-ghost btn-sm">📩</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-8 text-center text-[13px] text-muted">
      {text}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${danger ? "!text-danger" : ""}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function BreakCard({
  color,
  title,
  value,
  sub,
}: {
  color: string;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="card-title">{title}</div>
      <div className="font-display text-3xl font-extrabold text-ink">{value}</div>
      <div className="text-[13px] text-muted">{sub}</div>
    </div>
  );
}
