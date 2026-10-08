import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, hasDb } from "@/lib/db/client";
import { users, registrations, events, classes as classesTable } from "@/lib/db/schema";
import type { Registration } from "@/lib/data";
import { withLiveEventSeats } from "@/lib/services";

async function count(query: Promise<{ n: number }[]>): Promise<number> {
  const rows = await query;
  return rows[0]?.n ?? 0;
}

const N = { n: sql<number>`count(*)::int` };

export type DashboardStats = {
  connected: boolean;
  totalStudents: number;
  classEnrollments: number;
  pendingBatch: number;
  revenue: number;
  overdue: number;
  classes: number;
  workshops: number;
  studio: number;
  newRegistrations: Registration[];
  paymentAlerts: Registration[];
  // KPI row
  totalRevenue: number;
  activeStudents: number;
  newRegistrationsCount: number;
  overdueAmount: number;
  // Needs attention
  overdueCount: number;
  unpaidCount: number;
  lowSeatEventsCount: number;
  // Charts
  revenueTrend: { month: string; amount: number }[];
  registrationsByLocation: { location: string; count: number }[];
  paymentHealth: { paid: number; overdue: number; pending: number; onetime: number };
  bookingMix: { classes: number; workshopsEvents: number; studio: number };
  studentsTrend: { month: string; total: number }[];
  classesMix: { online: number; offline: number; total: number };
  upcomingThisWeek: {
    id: string;
    date: string;
    title: string;
    kind: string;
    location: string;
    booked: number;
    capacity: number;
  }[];
};

const EMPTY: DashboardStats = {
  connected: false,
  totalStudents: 0,
  classEnrollments: 0,
  pendingBatch: 0,
  revenue: 0,
  overdue: 0,
  classes: 0,
  workshops: 0,
  studio: 0,
  newRegistrations: [],
  paymentAlerts: [],
  totalRevenue: 0,
  activeStudents: 0,
  newRegistrationsCount: 0,
  overdueAmount: 0,
  overdueCount: 0,
  unpaidCount: 0,
  lowSeatEventsCount: 0,
  revenueTrend: [],
  registrationsByLocation: [],
  paymentHealth: { paid: 0, overdue: 0, pending: 0, onetime: 0 },
  bookingMix: { classes: 0, workshopsEvents: 0, studio: 0 },
  studentsTrend: [],
  classesMix: { online: 0, offline: 0, total: 0 },
  upcomingThisWeek: [],
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Only 3 round trips against the DB (registrations, users, events) — every
// other number below is derived from those in JS. The pool here caps at 5
// connections (see lib/db/client.ts); a prior version of this function fired
// ~17 queries in one Promise.all and blew through it under load.
export async function getDashboardStats(location?: string): Promise<DashboardStats> {
  if (!hasDb || !db) return EMPTY;
  try {
    const locFilter: SQL = location ? eq(registrations.location, location) : sql`true`;

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [allRegs, studentRows, storedEvents, allClasses] = await Promise.all([
      db.select().from(registrations).where(locFilter).orderBy(desc(registrations.createdAt)),
      db.select({ createdAt: users.createdAt }).from(users).where(eq(users.role, "student")),
      db
        .select()
        .from(events)
        .where(location ? eq(events.location, location) : sql`true`),
      db
        .select({ mode: classesTable.mode })
        .from(classesTable)
        .where(
          location
            ? and(eq(classesTable.active, true), eq(classesTable.location, location))
            : eq(classesTable.active, true)
        ),
    ]);
    const totalStudents = studentRows.length;
    // Real seats left, counting live bookings (the stored figure never goes down).
    const allEvents = await withLiveEventSeats(storedEvents);

    const classes = allRegs.filter((r) => r.type === "class").length;
    const studio = allRegs.filter((r) => r.type === "studio").length;
    const pendingBatch = allRegs.filter((r) => r.type === "class" && r.status === "Pending Batch").length;
    const overdueRows = allRegs.filter((r) => r.paid === "overdue");
    const overdueCount = overdueRows.length;
    const unpaidCount = allRegs.filter((r) => r.paid === "pending").length;
    const activeStudents = new Set(
      allRegs.filter((r) => r.status === "Active").map((r) => r.email)
    ).size;
    const newRegistrationsCount = allRegs.filter(
      (r) => r.createdAt && new Date(r.createdAt) >= monthStart
    ).length;
    const totalRevenue = allRegs.filter((r) => r.paid === "paid").reduce((s, r) => s + r.amount, 0);
    const overdueAmount = overdueRows.reduce((s, r) => s + r.amount, 0);
    const newRegistrations = allRegs.slice(0, 5);
    const paymentAlerts = overdueRows.slice(0, 5);

    const workshops = allEvents.filter((e) => !e.isPast).length;
    const lowSeatEventsCount = allEvents.filter(
      (e) => !e.isPast && e.seatsLeft > 0 && e.seatsLeft <= 3
    ).length;

    // Upcoming This Week — events/workshops only. Classes don't have a per-session booking
    // link yet (registrations record a category, not a specific class/date), so a "Booked"
    // count for them would be a guess; scoped out until that link exists.
    const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
    const upcomingThisWeek = allEvents
      .filter((e) => {
        if (e.isPast || !e.eventDate) return false;
        const d = new Date(e.eventDate);
        return d >= today && d <= weekEnd;
      })
      .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        date: e.eventDate!,
        title: e.title,
        kind: e.kind,
        location: e.location,
        booked: Math.max(0, e.seatsTotal - e.seatsLeft),
        capacity: e.seatsTotal,
      }));

    // Revenue trend — last 6 months, filling gaps so the line has no holes.
    const trendByMonth = new Map<string, number>();
    for (const r of allRegs) {
      if (r.paid !== "paid" || !r.createdAt) continue;
      const key = new Date(r.createdAt).toISOString().slice(0, 7);
      trendByMonth.set(key, (trendByMonth.get(key) ?? 0) + r.amount);
    }
    const revenueTrend: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      revenueTrend.push({ month: MONTH_LABELS[d.getMonth()], amount: trendByMonth.get(key) ?? 0 });
    }

    // Total students trend — cumulative headcount at the end of each of the last 6 months
    // (not new signups per month), so the line shows how the total has actually grown.
    const studentDates = studentRows
      .map((s) => s.createdAt)
      .filter((d): d is NonNullable<typeof d> => d != null)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const studentsTrend: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59);
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const total = studentDates.filter((sd) => new Date(sd) <= monthEnd).length;
      studentsTrend.push({ month: MONTH_LABELS[d.getMonth()], total });
    }

    // Classes mix — active classes split by delivery mode, so the dashboard shows at a glance
    // how many run online vs in-person (and the total count) without opening Classes.
    const classesMix = {
      online: allClasses.filter((c) => c.mode === "online").length,
      offline: allClasses.filter((c) => c.mode === "offline").length,
      total: allClasses.length,
    };

    const byLocationMap = new Map<string, number>();
    for (const r of allRegs) byLocationMap.set(r.location, (byLocationMap.get(r.location) ?? 0) + 1);
    const registrationsByLocation = Array.from(byLocationMap, ([location, count]) => ({ location, count })).sort(
      (a, b) => b.count - a.count
    );

    const paymentHealth = { paid: 0, overdue: 0, pending: 0, onetime: 0 };
    for (const r of allRegs) {
      if (r.paid in paymentHealth) paymentHealth[r.paid as keyof typeof paymentHealth]++;
    }

    const bookingMix = { classes: 0, workshopsEvents: 0, studio: 0 };
    for (const r of allRegs) {
      if (r.type === "class") bookingMix.classes++;
      else if (r.type === "workshop" || r.type === "event") bookingMix.workshopsEvents++;
      else if (r.type === "studio") bookingMix.studio++;
    }

    return {
      connected: true,
      totalStudents,
      classEnrollments: classes,
      pendingBatch,
      revenue: totalRevenue,
      overdue: overdueCount,
      classes,
      workshops,
      studio,
      newRegistrations: newRegistrations as unknown as Registration[],
      paymentAlerts: paymentAlerts as unknown as Registration[],
      totalRevenue,
      activeStudents,
      newRegistrationsCount,
      overdueAmount,
      overdueCount,
      unpaidCount,
      lowSeatEventsCount,
      revenueTrend,
      registrationsByLocation,
      paymentHealth,
      bookingMix,
      studentsTrend,
      classesMix,
      upcomingThisWeek,
    };
  } catch (err) {
    console.error("[stats] dashboard query failed:", err);
    return EMPTY;
  }
}

export type PaymentStats = {
  connected: boolean;
  paidThisMonth: number;
  overdue: number;
  dueSoon: number;
  revenue: number;
  rows: Registration[];
};

export async function getPaymentStats(): Promise<PaymentStats> {
  const empty: PaymentStats = {
    connected: false,
    paidThisMonth: 0,
    overdue: 0,
    dueSoon: 0,
    revenue: 0,
    rows: [],
  };
  if (!hasDb || !db) return empty;
  try {
    const [paid, overdue, revenueRows, rows] = await Promise.all([
      count(db.select(N).from(registrations).where(eq(registrations.paid, "paid"))),
      count(db.select(N).from(registrations).where(eq(registrations.paid, "overdue"))),
      db
        .select({ sum: sql<number>`coalesce(sum(${registrations.amount}),0)::int` })
        .from(registrations)
        .where(eq(registrations.paid, "paid")),
      db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(50),
    ]);
    return {
      connected: true,
      paidThisMonth: paid,
      overdue,
      dueSoon: 0,
      revenue: revenueRows[0]?.sum ?? 0,
      rows: rows as unknown as Registration[],
    };
  } catch (err) {
    console.error("[stats] payments query failed:", err);
    return empty;
  }
}

export type StudioBookingView = {
  name: string;
  when: string; // detail string, already includes date/time/purpose
  period: string | null; // raw date, YYYY-MM-DD when the booking flow stored one
  location: string;
  price: number;
  discountCode?: string | null;
  paid: "paid" | "overdue" | "pending" | "onetime";
  status: string;
  notes?: string | null; // the customer's own notes from the booking form
};

// Reads from `registrations` (type='studio') — the same table every booking
// flow (user-facing + Book Studio on Behalf) writes to. Replaces the old
// normalized bookings/studio_bookings tables, which nothing ever wrote to.
export async function getStudioBookings(): Promise<{
  connected: boolean;
  rows: StudioBookingView[];
}> {
  if (!hasDb || !db) return { connected: false, rows: [] };
  try {
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.type, "studio"))
      .orderBy(desc(registrations.createdAt))
      .limit(50);
    return {
      connected: true,
      rows: rows.map((r) => ({
        name: r.name,
        when: r.detail || r.period || "",
        period: r.period,
        location: r.location,
        price: r.amount ?? 0,
        discountCode: r.discountCode,
        paid: r.paid,
        status: r.status,
        notes: r.notes,
      })),
    };
  } catch (err) {
    console.error("[stats] studio query failed:", err);
    return { connected: false, rows: [] };
  }
}

// Recent class registrations — reads from `registrations` (type='class'),
// same table the user booking flow and Book on Behalf both write to.
export async function getRecentClassBookings(limit = 20): Promise<{
  connected: boolean;
  rows: Registration[];
}> {
  if (!hasDb || !db) return { connected: false, rows: [] };
  try {
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.type, "class"))
      .orderBy(desc(registrations.createdAt))
      .limit(limit);
    return { connected: true, rows: rows as unknown as Registration[] };
  } catch (err) {
    console.error("[stats] recent class bookings query failed:", err);
    return { connected: false, rows: [] };
  }
}

// ───────────── Unified Reports (all admin features, one page) ─────────────
export type ReportFilters = {
  month?: string; // YYYY-MM
  location?: string;
  type?: "class" | "workshop" | "event" | "studio";
};

export type FullReport = {
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
  byCategory: { label: string; count: number }[];
  byLocation: { label: string; count: number }[];
  byType: { label: string; count: number }[];
  byPlan: { label: string; count: number }[];
  rows: Registration[];
};

const EMPTY_REPORT: FullReport = {
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

// Small helper: turn a list into {label,count} buckets sorted by count desc.
function bucketBy<T>(items: T[], key: (item: T) => string | null | undefined): Bucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
type Bucket = { label: string; count: number };

/**
 * Only 2 DB round trips (down from 11): breakdowns/overdue/revenue are all
 * derived in JS from the single filtered `rows` fetch, and the 4 catalog
 * counts are combined into one UNION ALL query. Supabase's transaction
 * pooler has a small shared connection/statement-timeout budget — firing a
 * dozen aggregate queries in parallel exhausted it under load.
 */
export async function getFullReport(filters: ReportFilters): Promise<FullReport> {
  if (!hasDb || !db) return EMPTY_REPORT;
  try {
    const conds: SQL[] = [];
    if (filters.location) conds.push(eq(registrations.location, filters.location));
    if (filters.type) {
      if (filters.type === "workshop") {
        conds.push(sql`${registrations.type} in ('workshop','event')`);
      } else {
        conds.push(eq(registrations.type, filters.type));
      }
    }
    if (filters.month) {
      conds.push(sql`to_char(${registrations.createdAt}, 'YYYY-MM') = ${filters.month}`);
    }
    const where = conds.length ? and(...conds) : undefined;

    const [rows, catalogRows] = await Promise.all([
      db.select().from(registrations).where(where).orderBy(desc(registrations.createdAt)).limit(200),
      db.execute<{ k: string; n: number }>(sql`
        select 'classes' as k, count(*)::int as n from classes where active = true
        union all
        select 'events', count(*)::int from events where is_past = false
        union all
        select 'discounts', count(*)::int from discounts where active = true
        union all
        select 'studioBlocks', count(*)::int from studio_blocks
      `),
    ]);

    const catalog = Object.fromEntries(catalogRows.map((r) => [r.k, r.n]));
    const classBookings = rows.filter((r) => r.type === "class").length;
    const workshopEventBookings = rows.filter((r) => r.type === "workshop" || r.type === "event").length;
    const studioBookingsCount = rows.filter((r) => r.type === "studio").length;
    const overdue = rows.filter((r) => r.paid === "overdue").length;
    const revenue = rows.filter((r) => r.paid === "paid").reduce((sum, r) => sum + (r.amount ?? 0), 0);

    return {
      connected: true,
      kpis: {
        totalRegistrations: rows.length,
        revenue,
        overdue,
        classBookings,
        workshopEventBookings,
        studioBookings: studioBookingsCount,
        activeClasses: catalog.classes ?? 0,
        activeEvents: catalog.events ?? 0,
        activeDiscounts: catalog.discounts ?? 0,
        activeStudioBlocks: catalog.studioBlocks ?? 0,
      },
      byCategory: bucketBy(rows, (r) => r.category),
      byLocation: bucketBy(rows, (r) => r.location),
      byType: bucketBy(rows, (r) => r.type),
      byPlan: bucketBy(rows, (r) => (r.plan?.trim() ? r.plan : null)),
      rows: rows as unknown as Registration[],
    };
  } catch (err) {
    console.error("[stats] full report query failed:", err);
    return EMPTY_REPORT;
  }
}
