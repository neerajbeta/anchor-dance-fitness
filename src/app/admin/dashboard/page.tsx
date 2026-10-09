import Link from "next/link";
import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { DashboardLocationFilter } from "@/components/DashboardLocationFilter";
import { RevenueTrendChart } from "@/components/charts/RevenueTrendChart";
import { LocationBarChart } from "@/components/charts/LocationBarChart";
import { PaymentHealthChart } from "@/components/charts/PaymentHealthChart";
import { BookingMixChart } from "@/components/charts/BookingMixChart";
import { StudentsTrendChart } from "@/components/charts/StudentsTrendChart";
import { ClassesMixChart } from "@/components/charts/ClassesMixChart";
import { getDashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  // Next 15 hands these to the page as a promise.
  searchParams: Promise<{ location?: string }>;
}) {
  const location = (await searchParams).location || undefined;
  const s = await getDashboardStats(location);

  return (
    <AdminShell>
      <SectionHead
        title="Admin Dashboard"
        sub={location ? `Live overview · ${location}` : "Live overview · All locations"}
        right={
          <div className="flex items-center gap-2">
            {s.connected ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <Suspense fallback={<div className="field w-auto text-[13px]">Location: All</div>}>
              <DashboardLocationFilter />
            </Suspense>
          </div>
        }
      />

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi label="Total Revenue" value={`SEK ${s.totalRevenue.toLocaleString()}`} sub="Confirmed payments" />
        <Kpi label="Active Students" value={String(s.activeStudents)} sub="Currently active" />
        <Kpi label="New Registrations" value={String(s.newRegistrationsCount)} sub="This month" />
        <Kpi
          label="Overdue Payments"
          value={`SEK ${s.overdueAmount.toLocaleString()}`}
          sub={`${s.overdueCount} registration${s.overdueCount === 1 ? "" : "s"}`}
          danger
        />
      </div>

      {/* Charts row 1 */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">📈 Revenue Trend</div>
          <RevenueTrendChart data={s.revenueTrend} />
        </div>
        <div className="card">
          <div className="card-title">📍 Registrations by Location</div>
          <LocationBarChart data={s.registrationsByLocation} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">💳 Payment Health</div>
          <PaymentHealthChart data={s.paymentHealth} />
        </div>
        <div className="card">
          <div className="card-title">🥯 Booking Mix</div>
          <BookingMixChart data={s.bookingMix} />
        </div>
      </div>

      {/* Charts row 3 */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">🧑‍🎓 Overall Student Growth</div>
          <StudentsTrendChart data={s.studentsTrend} />
        </div>
        <div className="card">
          <div className="card-title">💃 Classes — Online vs In-Person</div>
          <ClassesMixChart data={s.classesMix} />
        </div>
      </div>

      {/* Upcoming this week */}
      <div className="card mb-5">
        <div className="card-title">📅 Upcoming This Week</div>
        {s.upcomingThisWeek.length === 0 ? (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-6 text-center text-[13px] text-muted">
            Nothing scheduled in the next 7 days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event / Workshop</th>
                  <th>Location</th>
                  <th>Booked</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {s.upcomingThisWeek.map((e) => {
                  const pct = e.capacity > 0 ? Math.round((e.booked / e.capacity) * 100) : 0;
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap font-semibold text-ink">
                        {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td>
                        {e.title}{" "}
                        <span className="badge badge-gray ml-1">{e.kind === "workshop" ? "Workshop" : "Event"}</span>
                      </td>
                      <td className="text-[12px] text-muted">{e.location}</td>
                      <td className="whitespace-nowrap">
                        {e.booked}/{e.capacity}
                      </td>
                      <td>
                        <span className={`badge ${pct >= 90 ? "badge-danger" : pct >= 60 ? "badge-warn" : "badge-ok"}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Needs attention */}
      <div className="card mb-5">
        <div className="card-title">🚨 Needs Attention</div>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <AttentionTile
            icon="🗓️"
            label="Pending Batch"
            value={s.pendingBatch}
            href="/admin/registrations"
          />
          <AttentionTile
            icon="⚠️"
            label="Overdue Payments"
            value={s.overdueCount}
            href="/admin/payments"
            danger={s.overdueCount > 0}
          />
          <AttentionTile
            icon="📩"
            label="Unpaid (Link Sent)"
            value={s.unpaidCount}
            href="/admin/payments"
            danger={s.unpaidCount > 0}
          />
          <AttentionTile
            icon="🪑"
            label="Low-seat Events"
            value={s.lowSeatEventsCount}
            href="/admin/events"
            danger={s.lowSeatEventsCount > 0}
          />
        </div>
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
            <Link href="/admin/reminders" className="btn btn-primary btn-sm no-underline">
              Send All Reminders
            </Link>
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

function AttentionTile({
  icon,
  label,
  value,
  href,
  danger,
}: {
  icon: string;
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border-[1.5px] p-3.5 transition-colors ${
        danger ? "border-danger/30 bg-danger/5 hover:border-danger/50" : "border-line bg-white hover:border-brand-400"
      }`}
    >
      <div className="mb-1 text-lg">{icon}</div>
      <div className={`font-display text-2xl font-extrabold ${danger ? "text-danger" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-muted">{label}</div>
    </Link>
  );
}
