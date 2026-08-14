import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  registrations,
  events,
  users,
  plans,
  coaches,
  batches,
  studioBlocks,
  locations,
  classes,
  categories,
  discounts,
  enquiries,
} from "@/lib/db/schema";

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_NOT_CONFIGURED");
  }
}

export class ConflictError extends Error {}

/**
 * Creates or refreshes a student user from a Google login. Email is the
 * natural key (Google guarantees verified, unique emails per account).
 */
export async function upsertOAuthUser(input: { email: string; name: string }) {
  const d = requireDb();
  const email = input.email.trim().toLowerCase();
  const [row] = await d
    .insert(users)
    .values({ name: input.name, email, role: "student" })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: input.name },
    })
    .returning();
  return row;
}

function requireDb() {
  if (!db) throw new DbNotConfiguredError();
  return db;
}

const AVATAR_COLORS = ["#EF5B2B", "#2E9E6B", "#8B5CF6", "#E0972B", "#3B82C4", "#DC4A3D"];
function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ───────────── Registrations ─────────────
export async function nextRegistrationId(): Promise<string> {
  const d = requireDb();
  const rows = await d.select({ id: registrations.id }).from(registrations);
  const max = rows.reduce((m, r) => {
    const n = parseInt(String(r.id).replace(/\D/g, ""), 10) || 0;
    return Math.max(m, n);
  }, 90);
  return `AF-${String(max + 1).padStart(4, "0")}`;
}

export type RegistrationInput = {
  name: string;
  email: string;
  age?: number | null;
  location: string;
  flag?: string;
  type: "class" | "workshop" | "event" | "studio";
  detail?: string;
  category?: string | null;
  level?: string | null;
  mode?: "online" | "offline" | null;
  period?: string;
  plan?: string;
  paid?: "paid" | "overdue" | "onetime";
  status?: string;
  statusTone?: string;
  /** Base price (SEK) before any discount — required to compute the charged amount. */
  baseAmount?: number;
  /** Discount Master code the user entered at checkout, if any. */
  discountCode?: string;
  classId?: string; // used to resolve a scope="class" discount
};

export type CreateRegistrationResult = Awaited<ReturnType<typeof insertRegistration>>;

async function insertRegistration(input: RegistrationInput, amount: number, appliedCode: string | null) {
  const d = requireDb();
  const id = await nextRegistrationId();
  const initial = (input.name.trim()[0] || "?").toUpperCase();
  const row = {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    age: input.age ?? null,
    initial,
    color: colorFor(input.email || input.name),
    location: input.location,
    flag: input.flag ?? "",
    type: input.type,
    detail: input.detail ?? "",
    category: input.category ?? null,
    level: input.level ?? null,
    mode: input.mode ?? null,
    period: input.period ?? "",
    plan: input.plan ?? "",
    paid: input.paid ?? "paid",
    status: input.status ?? "Active",
    statusTone: input.statusTone ?? "ok",
    amount,
    discountCode: appliedCode,
  } as const;

  await d.insert(registrations).values(row);

  // Keep a matching student user so dashboards/counts stay consistent.
  await d
    .insert(users)
    .values({
      name: row.name,
      email: row.email,
      role: "student",
      age: row.age ?? undefined,
      location: row.location,
      flag: row.flag,
    })
    .onConflictDoNothing({ target: users.email });

  return row;
}

/**
 * Creates a registration. If `discountCode` + `baseAmount` are given, resolves
 * the code server-side (never trusts a client-computed total) and stores the
 * discounted amount + code. Falls back to `baseAmount` (or 0) when no code.
 */
export async function createRegistration(input: RegistrationInput) {
  const base = input.baseAmount ?? 0;
  let amount = base;
  let appliedCode: string | null = null;

  if (input.discountCode) {
    const resolved = await resolveDiscount({
      code: input.discountCode,
      category: input.category ?? undefined,
      classId: input.classId,
    });
    if (resolved) {
      amount =
        resolved.type === "flat"
          ? Math.max(0, base - resolved.flatAmount)
          : Math.round(base * (1 - resolved.percent / 100));
      appliedCode = resolved.code;
    }
  }

  return insertRegistration(input, amount, appliedCode);
}

export async function listRegistrations() {
  return requireDb().select().from(registrations).orderBy(desc(registrations.createdAt));
}

// ───────────── Events ─────────────
export type EventInput = {
  kind: "workshop" | "event";
  title: string;
  description?: string;
  emoji?: string;
  date: string; // display string
  eventDate?: string; // start date YYYY-MM-DD
  endDate?: string; // end date YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  mode: "online" | "offline";
  location: string;
  coach?: string;
  price: number;
  seatsTotal: number;
  couponCode?: string;
};

export async function createEvent(input: EventInput) {
  const d = requireDb();

  // Guard: end must be after start (no equal, no back time).
  if (input.startTime && input.endTime && input.endTime <= input.startTime) {
    throw new ConflictError("End time must be after start time.");
  }

  // Conflict: same location + overlapping DATE RANGE + overlapping TIME = clash.
  if (input.eventDate && input.startTime && input.endTime) {
    const aStart = input.eventDate;
    const aEnd = input.endDate || input.eventDate;
    const ns = input.startTime,
      ne = input.endTime;
    const hm = (t: string) => t.slice(0, 5); // DB time HH:MM:SS → HH:MM
    const sameLoc = await d
      .select({ s: events.startTime, e: events.endTime, sd: events.eventDate, ed: events.endDate })
      .from(events)
      .where(eq(events.location, input.location));
    const clash = sameLoc.some((r) => {
      if (!r.s || !r.e || !r.sd) return false;
      const bStart = r.sd;
      const bEnd = r.ed || r.sd;
      const dateOverlap = aStart <= bEnd && bStart <= aEnd;
      const timeOverlap = ns < hm(r.e) && hm(r.s) < ne;
      return dateOverlap && timeOverlap;
    });
    if (clash) {
      throw new ConflictError("An event is already registered at this location, date and time.");
    }
  }

  const [ev] = await d
    .insert(events)
    .values({
      kind: input.kind,
      title: input.title,
      description: input.description ?? "",
      emoji: input.emoji ?? (input.kind === "workshop" ? "🎭" : "⭐"),
      couponCode: input.couponCode ? input.couponCode.trim().toUpperCase() : null,
      date: input.date,
      eventDate: input.eventDate ?? null,
      endDate: input.endDate ?? input.eventDate ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      mode: input.mode,
      location: input.location,
      coach: input.coach ?? "",
      price: input.price,
      seatsLeft: input.seatsTotal,
      seatsTotal: input.seatsTotal,
      isPast: false,
      isOpen: true,
    })
    .returning();
  return ev;
}

export async function updateEvent(id: string, patch: Partial<EventInput>) {
  const d = requireDb();
  const [ev] = await d.update(events).set(patch).where(eq(events.id, id)).returning();
  return ev;
}

export async function deleteEvent(id: string) {
  await requireDb().delete(events).where(eq(events.id, id));
}

export async function listEvents() {
  return requireDb().select().from(events).orderBy(desc(events.createdAt));
}

// ───────────── Students (search for Book on Behalf) ─────────────
export async function searchStudents(q: string) {
  const d = requireDb();
  const term = `%${q.trim()}%`;
  const where = q.trim()
    ? and(eq(users.role, "student"), or(ilike(users.name, term), ilike(users.email, term)))
    : eq(users.role, "student");
  return d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      location: users.location,
      flag: users.flag,
      age: users.age,
    })
    .from(users)
    .where(where)
    .limit(10);
}

// ───────────── Studio blocks ─────────────
export type StudioBlockInput = {
  location: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  reason?: string;
};

export async function createStudioBlock(input: StudioBlockInput) {
  const d = requireDb();
  const [row] = await d
    .insert(studioBlocks)
    .values({
      location: input.location,
      date: input.date,
      endDate: input.endDate || input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason ?? null,
    })
    .returning();
  return row;
}

export async function listStudioBlocks() {
  return requireDb().select().from(studioBlocks).orderBy(studioBlocks.date);
}

export async function deleteStudioBlock(id: string) {
  await requireDb().delete(studioBlocks).where(eq(studioBlocks.id, id));
}

// ───────────── Locations (admin-managed) ─────────────
export async function listLocations() {
  return requireDb().select().from(locations).where(eq(locations.active, true)).orderBy(locations.label);
}

export async function createLocation(input: { label: string; country?: string; flag?: string }) {
  const d = requireDb();
  const [row] = await d
    .insert(locations)
    .values({ label: input.label.trim(), country: input.country ?? null, flag: input.flag ?? null })
    .onConflictDoNothing({ target: locations.label })
    .returning();
  return row ?? null;
}

export async function updateLocation(
  id: string,
  patch: { label?: string; country?: string; flag?: string }
) {
  const d = requireDb();
  const [row] = await d
    .update(locations)
    .set({
      ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      ...(patch.country !== undefined ? { country: patch.country || null } : {}),
      ...(patch.flag !== undefined ? { flag: patch.flag || null } : {}),
    })
    .where(eq(locations.id, id))
    .returning();
  return row ?? null;
}

export async function deleteLocation(id: string) {
  await requireDb().delete(locations).where(eq(locations.id, id));
}

// ───────────── Categories (admin-managed) ─────────────
export async function listCategories() {
  return requireDb().select().from(categories).where(eq(categories.active, true)).orderBy(categories.name);
}

export async function createCategory(name: string) {
  const d = requireDb();
  const [row] = await d
    .insert(categories)
    .values({ name: name.trim() })
    .onConflictDoNothing({ target: categories.name })
    .returning();
  return row ?? null;
}

export async function updateCategory(id: string, patch: { name?: string }) {
  const d = requireDb();
  const [row] = await d
    .update(categories)
    .set({ ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) })
    .where(eq(categories.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCategory(id: string) {
  await requireDb().delete(categories).where(eq(categories.id, id));
}

// ───────────── Classes (admin-managed, fixed time) ─────────────
export type ClassInput = {
  name: string;
  category: string;
  level: string;
  location: string;
  mode: "online" | "offline";
  days?: string;
  startDate?: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  coach?: string;
  price?: number;
  capacity?: number;
};

export async function listClasses() {
  return requireDb().select().from(classes).where(eq(classes.active, true)).orderBy(classes.name);
}

export async function createClass(input: ClassInput) {
  if (input.endTime <= input.startTime) {
    throw new ConflictError("End time must be after start time.");
  }
  const d = requireDb();
  const [row] = await d
    .insert(classes)
    .values({
      name: input.name.trim(),
      category: input.category,
      level: input.level,
      location: input.location,
      mode: input.mode,
      days: input.days ?? null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      startTime: input.startTime,
      endTime: input.endTime,
      coach: input.coach ?? null,
      price: input.price ?? 0,
      capacity: input.capacity ?? 20,
    })
    .returning();
  return row;
}

export async function updateClass(id: string, patch: Partial<ClassInput>) {
  if (patch.startTime && patch.endTime && patch.endTime <= patch.startTime) {
    throw new ConflictError("End time must be after start time.");
  }
  const d = requireDb();
  const [row] = await d
    .update(classes)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.level !== undefined ? { level: patch.level } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
      ...(patch.days !== undefined ? { days: patch.days || null } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate || null } : {}),
      ...(patch.endDate !== undefined ? { endDate: patch.endDate || null } : {}),
      ...(patch.startTime !== undefined ? { startTime: patch.startTime } : {}),
      ...(patch.endTime !== undefined ? { endTime: patch.endTime } : {}),
      ...(patch.coach !== undefined ? { coach: patch.coach || null } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
    })
    .where(eq(classes.id, id))
    .returning();
  return row ?? null;
}

export async function deleteClass(id: string) {
  await requireDb().delete(classes).where(eq(classes.id, id));
}

// ───────────── Discounts (Discount Master) ─────────────
export type DiscountInput = {
  name: string;
  code: string;
  type?: "percent" | "flat";
  percent?: number;
  flatAmount?: number;
  scope: "all" | "category" | "class";
  target?: string;
};

export async function listDiscounts() {
  return requireDb().select().from(discounts).where(eq(discounts.active, true)).orderBy(discounts.code);
}

export async function createDiscount(input: DiscountInput) {
  const d = requireDb();
  const type = input.type === "flat" ? "flat" : "percent";
  const pct = type === "percent" ? Math.max(0, Math.min(100, Math.round(input.percent ?? 0))) : null;
  const flat = type === "flat" ? Math.max(0, Math.round(input.flatAmount ?? 0)) : null;
  const [row] = await d
    .insert(discounts)
    .values({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      type,
      percent: pct,
      flatAmount: flat,
      scope: input.scope,
      target: input.scope === "all" ? null : input.target ?? null,
    })
    .onConflictDoNothing({ target: discounts.code })
    .returning();
  return row ?? null;
}

export async function updateDiscount(id: string, patch: Partial<DiscountInput>) {
  const d = requireDb();
  const type = patch.type;
  const [row] = await d
    .update(discounts)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.code !== undefined ? { code: patch.code.trim().toUpperCase() } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(patch.percent !== undefined
        ? { percent: Math.max(0, Math.min(100, Math.round(patch.percent))) }
        : {}),
      ...(patch.flatAmount !== undefined ? { flatAmount: Math.max(0, Math.round(patch.flatAmount)) } : {}),
      ...(type === "percent" ? { flatAmount: null } : {}),
      ...(type === "flat" ? { percent: null } : {}),
      ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
      ...(patch.scope !== undefined
        ? { target: patch.scope === "all" ? null : patch.target ?? null }
        : patch.target !== undefined
          ? { target: patch.target ?? null }
          : {}),
    })
    .where(eq(discounts.id, id))
    .returning();
  return row ?? null;
}

export async function deleteDiscount(id: string) {
  await requireDb().delete(discounts).where(eq(discounts.id, id));
}

/** Resolve applicable discount for a code + item context (percent or flat). */
export async function resolveDiscount(opts: {
  code?: string;
  category?: string;
  classId?: string;
}): Promise<{ code: string; type: "percent" | "flat"; percent: number; flatAmount: number } | null> {
  if (!opts.code) return null;
  const d = requireDb();
  const rows = await d
    .select()
    .from(discounts)
    .where(and(eq(discounts.active, true), eq(discounts.code, opts.code.trim().toUpperCase())));
  const disc = rows[0];
  if (!disc) return null;
  if (disc.scope === "category" && disc.target !== opts.category) return null;
  if (disc.scope === "class" && disc.target !== opts.classId) return null;
  return {
    code: disc.code,
    type: disc.type,
    percent: disc.percent ?? 0,
    flatAmount: disc.flatAmount ?? 0,
  };
}

// ───────────── Reports ─────────────
export async function getCategoryReport(opts: { month?: string; location?: string }) {
  const d = requireDb();
  const conds = [sql`category is not null`];
  if (opts.location) conds.push(eq(registrations.location, opts.location));
  if (opts.month) conds.push(sql`to_char(${registrations.createdAt}, 'YYYY-MM') = ${opts.month}`);
  return d
    .select({
      category: registrations.category,
      count: sql<number>`count(*)::int`,
    })
    .from(registrations)
    .where(and(...conds))
    .groupBy(registrations.category)
    .orderBy(sql`count(*) desc`);
}

// ───────────── Catalog ─────────────
export async function listPlans() {
  return requireDb().select().from(plans).where(eq(plans.active, true));
}
export async function listCoaches() {
  return requireDb().select().from(coaches).where(eq(coaches.active, true));
}
export async function listBatches() {
  return requireDb().select().from(batches).where(eq(batches.active, true));
}

// ───────────── Enquiries ("Book a Demo" leads) ─────────────
export type EnquiryInput = {
  fullName: string;
  age?: number;
  email: string;
  phoneCountryCode?: string;
  phone: string;
  areaOfInterest?: string;
  typeOfClass?: string;
  preferredLocation?: string;
  additionalInfo?: string;
  consent: boolean;
};

export async function createEnquiry(input: EnquiryInput) {
  const d = requireDb();
  const [row] = await d
    .insert(enquiries)
    .values({
      fullName: input.fullName.trim(),
      age: input.age ?? null,
      email: input.email.trim(),
      phoneCountryCode: input.phoneCountryCode ?? null,
      phone: input.phone.trim(),
      areaOfInterest: input.areaOfInterest ?? null,
      typeOfClass: input.typeOfClass ?? null,
      preferredLocation: input.preferredLocation ?? null,
      additionalInfo: input.additionalInfo ?? null,
      consent: input.consent,
    })
    .returning();
  return row;
}

export async function listEnquiries() {
  return requireDb().select().from(enquiries).orderBy(desc(enquiries.createdAt));
}

export async function updateEnquiryStatus(id: string, status: "new" | "contacted" | "closed") {
  const d = requireDb();
  const [row] = await d.update(enquiries).set({ status }).where(eq(enquiries.id, id)).returning();
  return row ?? null;
}
