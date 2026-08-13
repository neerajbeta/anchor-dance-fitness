import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, hasDb } from "@/lib/db/client";
import { users, registrations, events } from "@/lib/db/schema";
import type { Registration } from "@/lib/data";

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
};

export async function getDashboardStats(): Promise<DashboardStats> {
  if (!hasDb || !db) return EMPTY;
  try {
    const [
      totalStudents,
      classes,
      workshops,
      studio,
      pendingBatch,
      overdue,
      revenueRows,
      newRegistrations,
      paymentAlerts,
    ] = await Promise.all([
      count(db.select(N).from(users).where(eq(users.role, "student"))),
      count(db.select(N).from(registrations).where(eq(registrations.type, "class"))),
      count(db.select(N).from(events).where(eq(events.isPast, false))),
      count(db.select(N).from(registrations).where(eq(registrations.type, "studio"))),
      count(
        db
          .select(N)
          .from(registrations)
          .where(and(eq(registrations.type, "class"), eq(registrations.status, "Pending Batch")))
      ),
      count(db.select(N).from(registrations).where(eq(registrations.paid, "overdue"))),
      db
        .select({ sum: sql<number>`coalesce(sum(${registrations.amount}),0)::int` })
        .from(registrations)
        .where(eq(registrations.paid, "paid")),
      db.select().from(registrations).orderBy(desc(registrations.createdAt)).limit(5),
      db.select().from(registrations).where(eq(registrations.paid, "overdue")).limit(5),
    ]);

    return {
      connected: true,
      totalStudents,
      classEnrollments: classes,
      pendingBatch,
      revenue: revenueRows[0]?.sum ?? 0,
      overdue,
      classes,
      workshops,
      studio,
      newRegistrations: newRegistrations as unknown as Registration[],
      paymentAlerts: paymentAlerts as unknown as Registration[],
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
  location: string;
  price: number;
  discountCode?: string | null;
  paid: "paid" | "overdue" | "onetime";
  status: string;
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
        location: r.location,
        price: r.amount ?? 0,
        discountCode: r.discountCode,
        paid: r.paid,
        status: r.status,
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
