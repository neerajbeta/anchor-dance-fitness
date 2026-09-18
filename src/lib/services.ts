import bcrypt from "bcryptjs";
import { and, desc, eq, getTableColumns, gt, ilike, isNull, or, sql } from "drizzle-orm";
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
  levels,
  discounts,
  enquiries,
  announcements,
  roles,
  permissions,
  rolePermissions,
  auditLogs,
  eventMedia,
  appSettings,
  emailTemplates,
  emailLog,
} from "@/lib/db/schema";
import { planTotal, type PlanInput } from "@/lib/plans";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_NOT_CONFIGURED");
  }
}

export class ConflictError extends Error {}

/** Signup attempted with an email that already has a sign-in-able account. */
export class EmailTakenError extends Error {}

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
    // xmax = 0 only on a freshly inserted row — tells a first Google sign-up
    // (which gets the welcome email) apart from a returning user.
    .returning({ ...getTableColumns(users), created: sql<boolean>`(xmax = 0)` });
  return row;
}

/**
 * Registers a student profile from the "Your Details" signup form; the route
 * then logs them straight in. Email is the natural key. An existing account
 * that can already sign in (has a password, or is an admin-panel account) is
 * never overwritten — that would let anyone reset someone else's password —
 * so it throws EmailTakenError. A password-less student profile (created via
 * Google or Book on Behalf) can be claimed by completing signup.
 */
export type RegisterStudentInput = {
  name: string;
  email: string;
  password: string;
  dob?: string;
  gender?: string;
  phone?: string;
  city?: string;
  country?: string;
};

export async function registerStudent(input: RegisterStudentInput) {
  const d = requireDb();
  const email = input.email.trim().toLowerCase();
  const [existing] = await d
    .select({ role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));
  if (existing && (existing.role !== "student" || existing.passwordHash)) {
    throw new EmailTakenError();
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const values = {
    name: input.name.trim(),
    email,
    role: "student" as const,
    passwordHash,
    dob: input.dob || null,
    gender: input.gender || null,
    phone: input.phone || null,
    city: input.city || null,
    country: input.country || null,
  };
  const [row] = await d
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: values.name,
        passwordHash: values.passwordHash,
        dob: values.dob,
        gender: values.gender,
        phone: values.phone,
        city: values.city,
        country: values.country,
      },
    })
    .returning();
  return row;
}

/** Verifies a student's email + password. Returns the session payload, or null. */
export async function verifyStudentCredentials(
  email: string,
  password: string
): Promise<{ email: string; name: string; role: string } | null> {
  const d = requireDb();
  const normEmail = email.trim().toLowerCase();
  if (!normEmail || !password) return null;
  const rows = await d.select().from(users).where(and(eq(users.email, normEmail), eq(users.role, "student")));
  const u = rows[0];
  if (!u?.passwordHash) return null;
  if (!(await bcrypt.compare(password, u.passwordHash))) return null;
  return { email: u.email, name: u.name, role: u.role };
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
  paid?: "paid" | "overdue" | "pending" | "onetime";
  status?: string;
  statusTone?: string;
  /** Base price (SEK) before any discount — required to compute the charged amount. */
  baseAmount?: number;
  /** Discount Master code the user entered at checkout, if any. */
  discountCode?: string;
  classId?: string; // used to resolve a scope="class" discount
  eventId?: string; // used to resolve a scope="event"/"workshop" discount
  /** Free-text notes from the customer (e.g. studio requirements). */
  notes?: string | null;
};

/** Longest customer note stored with a booking. */
export const BOOKING_NOTES_MAX = 500;

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
    eventId: input.eventId ?? null,
    classId: input.classId || null,
    // Trimmed and capped here, whatever the caller sent.
    notes: String(input.notes ?? "").trim().slice(0, BOOKING_NOTES_MAX) || null,
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
      eventId: input.eventId,
      bookingType: input.type,
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

export async function getRegistrationById(id: string) {
  const [row] = await requireDb().select().from(registrations).where(eq(registrations.id, id));
  return row ?? null;
}

/** Looks a booking up by the gateway's own id (Stripe session / Swish instruction id). */
export async function getRegistrationByPaymentRef(ref: string) {
  const [row] = await requireDb().select().from(registrations).where(eq(registrations.paymentRef, ref));
  return row ?? null;
}

/** Records which gateway a booking is being paid through, before we send the user to it. */
export async function attachPaymentRef(id: string, method: "stripe" | "swish", ref: string) {
  await requireDb()
    .update(registrations)
    .set({ paymentMethod: method, paymentRef: ref })
    .where(eq(registrations.id, id));
}

export class PriceError extends Error {}

/**
 * The price (SEK, before discount) of a self-service booking, worked out from
 * the database — never taken from the browser, since this is what the customer
 * is charged. Throws PriceError when the booking doesn't match anything sellable.
 *
 *  - Studio Hire   → hours (from the "HH:MM–HH:MM" in detail) × studio hourly rate
 *  - Workshop/Event → the event's price
 *  - Class          → the chosen plan's total at that class's monthly price
 *  - Plan only      → the chosen plan's total
 */
export async function priceBooking(input: {
  type: string;
  detail?: string | null;
  plan?: string | null;
  classId?: string | null;
  eventId?: string | null;
}): Promise<number> {
  const d = requireDb();

  if (input.type === "studio") {
    const m = /(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/.exec(input.detail ?? "");
    if (!m) throw new PriceError("Choose a studio start time.");
    const start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[3]) * 60 + Number(m[4]);
    if (end <= start) end += 24 * 60; // runs past midnight
    const { studioHourlyRate } = await getPortalSettings();
    return Math.round(((end - start) / 60) * studioHourlyRate);
  }

  if (input.type === "workshop" || input.type === "event") {
    if (!input.eventId) throw new PriceError("This booking isn't linked to a workshop or event.");
    const [ev] = await d.select({ price: events.price }).from(events).where(eq(events.id, input.eventId));
    if (!ev) throw new PriceError("That workshop or event is no longer available.");
    return ev.price;
  }

  // Class, or a plan bought on its own.
  const [planRow] = input.plan
    ? await d.select().from(plans).where(and(eq(plans.name, input.plan), eq(plans.active, true)))
    : [];
  if (!planRow) throw new PriceError("Please choose a plan.");
  let classPrice: number | null = null;
  if (input.classId) {
    const [cls] = await d.select({ price: classes.price }).from(classes).where(eq(classes.id, input.classId));
    if (!cls) throw new PriceError("That class is no longer available.");
    classPrice = cls.price;
  }
  return planTotal(planRow, classPrice);
}

/** Status shown on a booking whose payment was abandoned, declined or expired. */
export const PAYMENT_CANCELLED_STATUS = "Payment Cancelled";

/** The status a booking normally carries once it's paid (what checkout originally set). */
function paidStatusFor(row: { type: string; detail: string | null }) {
  if (row.type === "class") {
    // Plan-only purchases are recorded as "<Plan> Plan" and are active immediately.
    return /\bPlan$/.test(row.detail ?? "")
      ? { status: "Active", statusTone: "ok" }
      : { status: "Pending Batch", statusTone: "warn" };
  }
  return { status: "Confirmed", statusTone: "ok" };
}

/**
 * Flips a booking to paid once the gateway has confirmed it. Only ever called
 * after a server-side check with Stripe/Swish — never on the client's say-so.
 * A payment first marked cancelled but then completed anyway gets its normal
 * status back.
 */
export async function markRegistrationPaid(id: string, method: "stripe" | "swish", ref: string) {
  const current = await getRegistrationById(id);
  if (!current) return null;
  const restore = current.status === PAYMENT_CANCELLED_STATUS ? paidStatusFor(current) : {};
  const [row] = await requireDb()
    .update(registrations)
    .set({ paid: "paid", paymentMethod: method, paymentRef: ref, ...restore })
    .where(eq(registrations.id, id))
    .returning();
  return row ?? null;
}

/**
 * Marks an unpaid booking as cancelled so admins don't mistake it for a real
 * one and a studio slot it was holding is released. Never touches a paid booking.
 */
export async function markRegistrationPaymentCancelled(id: string) {
  await requireDb()
    .update(registrations)
    .set({ status: PAYMENT_CANCELLED_STATUS, statusTone: "danger" })
    .where(and(eq(registrations.id, id), sql`${registrations.paid} <> 'paid'`));
}

/** Last YYYY-MM-DD in a period like "2026-09-20 – 2026-12-20" (class bookings). */
function periodEnd(period: string | null) {
  const dates = (period ?? "").match(/d{4}-d{2}-d{2}/g);
  return dates ? dates[dates.length - 1] : null;
}

export class DuplicateBookingError extends Error {
  constructor(
    message: string,
    readonly existingId: string
  ) {
    super(message);
  }
}

/**
 * The same person may hold only one live booking of a given class, workshop or
 * event. A booking stops counting once it's cancelled, once an abandoned
 * checkout is past PAYMENT_HOLD_MS, or (for classes) once its dates are over —
 * so a student can re-book a class for a new term. Studio hire and plan-only
 * purchases aren't limited.
 */
export async function findActiveDuplicate(input: {
  email: string;
  type: string;
  classId?: string | null;
  eventId?: string | null;
  detail?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const isEvent = input.type === "workshop" || input.type === "event";
  const isClass = input.type === "class" && Boolean(input.classId);
  if (!isEvent && !isClass) return null;
  if (isEvent && !input.eventId) return null;

  const holdSince = new Date(Date.now() - PAYMENT_HOLD_MS);
  const target = isEvent
    ? eq(registrations.eventId, input.eventId!)
    : or(
        eq(registrations.classId, input.classId!),
        // Class bookings made before class_id existed: same class text.
        and(isNull(registrations.classId), eq(registrations.detail, input.detail ?? ""))
      );
  const rows = await requireDb()
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.email, email),
        eq(registrations.type, input.type as "class" | "workshop" | "event"),
        target,
        sql`${registrations.status} <> ${PAYMENT_CANCELLED_STATUS}`,
        // An unpaid online checkout only counts while it could still be paid.
        or(
          sql`${registrations.paid} <> 'pending'`,
          isNull(registrations.paymentMethod),
          gt(registrations.createdAt, holdSince)
        )
      )
    )
    .orderBy(desc(registrations.createdAt));

  const today = new Date().toISOString().slice(0, 10);
  const live = rows.find((r) => {
    if (r.type !== "class") return true;
    const end = periodEnd(r.period);
    return !end || end >= today;
  });
  return live ?? null;
}

/** Throws DuplicateBookingError with a customer-friendly message if one exists. */
export async function assertNotDuplicateBooking(input: Parameters<typeof findActiveDuplicate>[0]) {
  const dup = await findActiveDuplicate(input);
  if (!dup) return;
  const what = dup.type === "class" ? "class" : dup.type;
  const unpaid = dup.paid === "pending" && dup.paymentMethod;
  throw new DuplicateBookingError(
    unpaid
      ? `A payment for this ${what} is already in progress (${dup.id}). Finish it, or try again in about 30 minutes.`
      : `You've already booked this ${what} (${dup.id}). You can see it in My Portal.`,
    dup.id
  );
}

/** Class and event ids a student currently holds, so booking pages can mark them. */
export async function getActiveBookedIds(email: string) {
  const holdSince = new Date(Date.now() - PAYMENT_HOLD_MS);
  const rows = await requireDb()
    .select({
      type: registrations.type,
      classId: registrations.classId,
      eventId: registrations.eventId,
      period: registrations.period,
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.email, email.trim().toLowerCase()),
        sql`${registrations.status} <> ${PAYMENT_CANCELLED_STATUS}`,
        or(
          sql`${registrations.paid} <> 'pending'`,
          isNull(registrations.paymentMethod),
          gt(registrations.createdAt, holdSince)
        )
      )
    );
  const today = new Date().toISOString().slice(0, 10);
  const classIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const r of rows) {
    if (r.eventId) eventIds.add(r.eventId);
    if (r.type === "class" && r.classId) {
      const end = periodEnd(r.period);
      if (!end || end >= today) classIds.add(r.classId);
    }
  }
  return { classIds: Array.from(classIds), eventIds: Array.from(eventIds) };
}

export async function listRegistrations() {
  return requireDb().select().from(registrations).orderBy(desc(registrations.createdAt));
}

/**
 * Everything the student portal shows for one signed-in student: their profile
 * and their bookings. Bookings are linked to a student by email.
 */
export async function getStudentPortalData(email: string) {
  const d = requireDb();
  const normEmail = email.trim().toLowerCase();
  const [profileRows, bookingRows] = await Promise.all([
    d
      .select({
        name: users.name,
        email: users.email,
        phone: users.phone,
        city: users.city,
        country: users.country,
        location: users.location,
        flag: users.flag,
      })
      .from(users)
      .where(eq(users.email, normEmail)),
    d
      .select()
      .from(registrations)
      .where(eq(registrations.email, normEmail))
      .orderBy(desc(registrations.createdAt)),
  ]);
  return { profile: profileRows[0] ?? null, registrations: bookingRows };
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

// Everyone who registered for this event/workshop. Only registrations created after eventId
// support was added carry the link — older bookings predate the column and won't appear here.
export async function getEventRegistrations(eventId: string) {
  return requireDb()
    .select({
      id: registrations.id,
      name: registrations.name,
      email: registrations.email,
      status: registrations.status,
      statusTone: registrations.statusTone,
      createdAt: registrations.createdAt,
    })
    .from(registrations)
    .where(eq(registrations.eventId, eventId))
    .orderBy(desc(registrations.createdAt));
}

// ───────────── Event media (photos/videos, admin-added by URL) ─────────────
export async function listEventMedia(eventId: string) {
  return requireDb()
    .select()
    .from(eventMedia)
    .where(eq(eventMedia.eventId, eventId))
    .orderBy(eventMedia.position);
}

export async function addEventMedia(input: { eventId: string; type: "photo" | "video"; url: string }) {
  const d = requireDb();
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(eventMedia)
    .where(eq(eventMedia.eventId, input.eventId));
  const [row] = await d
    .insert(eventMedia)
    .values({ eventId: input.eventId, type: input.type, url: input.url.trim(), position: n })
    .returning();
  return row;
}

export async function deleteEventMedia(id: string) {
  await requireDb().delete(eventMedia).where(eq(eventMedia.id, id));
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

/**
 * Public studio availability for one location + day: admin-blocked slots and
 * existing studio bookings, as plain time ranges (no names or emails).
 * Studio bookings store their time in `detail` ("… 11:00–13:00 · Purpose") and
 * their day in `period`, either as YYYY-MM-DD or the booking page's en-GB label.
 */
/**
 * How long an unpaid self-service booking counts as "in progress" — it keeps a
 * studio slot, and stops the same person starting a second checkout for the
 * same class/workshop/event. Stripe Checkout pages expire after 30 minutes
 * (see stripe.ts) and Swish requests after a few, so nothing older can still
 * turn into a payment.
 */
export const PAYMENT_HOLD_MS = 31 * 60 * 1000;
export const STUDIO_PAYMENT_HOLD_MS = PAYMENT_HOLD_MS;

export async function getStudioTakenSlots(location: string, date: string) {
  const d = requireDb();
  const [blockRows, bookingRows] = await Promise.all([
    d
      .select({
        date: studioBlocks.date,
        endDate: studioBlocks.endDate,
        startTime: studioBlocks.startTime,
        endTime: studioBlocks.endTime,
      })
      .from(studioBlocks)
      .where(eq(studioBlocks.location, location)),
    d
      .select({
        detail: registrations.detail,
        period: registrations.period,
        paid: registrations.paid,
        status: registrations.status,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(and(eq(registrations.type, "studio"), eq(registrations.location, location))),
  ]);

  const hm = (t: string) => t.slice(0, 5);
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const ranges: { start: string; end: string; reason: "Blocked" | "Booked" }[] = [];
  for (const b of blockRows) {
    if (b.date <= date && (b.endDate ?? b.date) >= date) {
      ranges.push({ start: hm(b.startTime), end: hm(b.endTime), reason: "Blocked" });
    }
  }
  const holdSince = Date.now() - STUDIO_PAYMENT_HOLD_MS;
  for (const r of bookingRows) {
    if (r.period !== date && r.period !== label) continue;
    // A slot stays taken once paid. While a payment is in progress it's held
    // briefly, so nobody else grabs it; an abandoned payment releases it.
    if (r.status === PAYMENT_CANCELLED_STATUS) continue;
    if (r.paid === "pending" && (!r.createdAt || r.createdAt.getTime() < holdSince)) continue;
    const m = r.detail?.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
    if (m) ranges.push({ start: m[1], end: m[2], reason: "Booked" });
  }
  return ranges;
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

// ───────────── Levels (admin-managed) ─────────────
export async function listLevels() {
  return requireDb().select().from(levels).where(eq(levels.active, true)).orderBy(levels.name);
}

export async function createLevel(name: string) {
  const d = requireDb();
  const [row] = await d
    .insert(levels)
    .values({ name: name.trim() })
    .onConflictDoNothing({ target: levels.name })
    .returning();
  return row ?? null;
}

export async function updateLevel(id: string, patch: { name?: string }) {
  const d = requireDb();
  const [row] = await d
    .update(levels)
    .set({ ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) })
    .where(eq(levels.id, id))
    .returning();
  return row ?? null;
}

export async function deleteLevel(id: string) {
  await requireDb().delete(levels).where(eq(levels.id, id));
}

// ───────────── Announcements (admin broadcasts to students) ─────────────
export type AnnouncementInput = {
  title: string;
  message: string;
  tone?: "info" | "warning" | "urgent";
  expiresAt?: Date | null;
};

// Public/portal-facing: only announcements that are active and not yet expired.
export async function listAnnouncements() {
  return requireDb()
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.active, true),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(announcements.createdAt));
}

// Admin-facing: every announcement, including expired ones, so admins can edit/extend/remove them.
export async function listAllAnnouncements() {
  return requireDb().select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(input: AnnouncementInput) {
  const d = requireDb();
  const [row] = await d
    .insert(announcements)
    .values({
      title: input.title.trim(),
      message: input.message.trim(),
      tone: input.tone ?? "info",
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return row;
}

export async function updateAnnouncement(id: string, patch: Partial<AnnouncementInput>) {
  const d = requireDb();
  const [row] = await d
    .update(announcements)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.message !== undefined ? { message: patch.message.trim() } : {}),
      ...(patch.tone !== undefined ? { tone: patch.tone } : {}),
      ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
    })
    .where(eq(announcements.id, id))
    .returning();
  return row ?? null;
}

export async function deleteAnnouncement(id: string) {
  await requireDb().delete(announcements).where(eq(announcements.id, id));
}

// ───────────── Roles & Permissions (admin RBAC) ─────────────
export type RoleInput = { name: string; description?: string | null; status?: "active" | "inactive" };

export async function listRoles() {
  const d = requireDb();
  const rows = await d.select().from(roles).orderBy(roles.createdAt);
  const counts = await d
    .select({ roleId: users.roleId, n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.roleId} is not null`)
    .groupBy(users.roleId);
  const countByRole = new Map(counts.map((c) => [c.roleId, c.n]));
  return rows.map((r) => ({ ...r, userCount: countByRole.get(r.id) ?? 0 }));
}

export async function getRoleById(id: string) {
  const [row] = await requireDb().select().from(roles).where(eq(roles.id, id));
  return row ?? null;
}

export async function getRoleBySlug(slug: string) {
  const [row] = await requireDb().select().from(roles).where(eq(roles.slug, slug));
  return row ?? null;
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createRole(input: RoleInput) {
  const d = requireDb();
  const slug = slugify(input.name);
  const existing = await d.select({ id: roles.id }).from(roles).where(eq(roles.slug, slug));
  if (existing.length > 0) throw new ConflictError("A role with this name already exists.");
  const [row] = await d
    .insert(roles)
    .values({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      status: input.status ?? "active",
    })
    .returning();
  return row;
}

export async function updateRole(id: string, patch: Partial<RoleInput>) {
  const d = requireDb();
  const role = await getRoleById(id);
  if (!role) return null;
  if (role.isSystemRole && patch.status === "inactive") {
    throw new ConflictError("The Super Admin role cannot be deactivated.");
  }
  const [row] = await d
    .update(roles)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim(), slug: slugify(patch.name) } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, id))
    .returning();
  return row ?? null;
}

export async function deleteRole(id: string) {
  const d = requireDb();
  const role = await getRoleById(id);
  if (!role) return;
  if (role.isSystemRole) throw new ConflictError("System roles cannot be deleted.");
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.roleId, id));
  if (n > 0) throw new ConflictError("This role is assigned to one or more users and cannot be deleted.");
  await d.delete(roles).where(eq(roles.id, id));
}

export async function listPermissions() {
  return requireDb().select().from(permissions).orderBy(permissions.module, permissions.slug);
}

export async function getRolePermissionSlugs(roleId: string): Promise<Set<string>> {
  const rows = await requireDb()
    .select({ slug: permissions.slug })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
  return new Set(rows.map((r) => r.slug));
}

// Replaces a role's entire permission set in one transaction. The Super Admin role is always
// full-access and cannot be edited here (enforced at the API layer too).
export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  const d = requireDb();
  await d.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionIds.length > 0) {
      await tx.insert(rolePermissions).values(permissionIds.map((permissionId) => ({ roleId, permissionId })));
    }
  });
}

// Ensures every permission in the catalog is granted to the Super Admin role, so "full access"
// holds automatically as new modules/permissions are added — no manual re-grant needed.
export async function syncSuperAdminPermissions() {
  const d = requireDb();
  const [superAdmin] = await d.select().from(roles).where(eq(roles.slug, "super-admin"));
  if (!superAdmin) return;
  const granted = await getRolePermissionSlugs(superAdmin.id);
  const allPerms = await d.select({ id: permissions.id, slug: permissions.slug }).from(permissions);
  const missing = allPerms.filter((p) => !granted.has(p.slug)).map((p) => p.id);
  if (missing.length > 0) {
    await d.insert(rolePermissions).values(missing.map((permissionId) => ({ roleId: superAdmin.id, permissionId })));
  }
}

// ───────────── Admin-panel users (User Management module) ─────────────
export type AdminUserInput = {
  name: string;
  email: string;
  password?: string;
  roleId: string;
  status?: "active" | "inactive";
  phone?: string | null;
  location?: string | null;
};

export type ListAdminUsersOpts = {
  search?: string;
  roleId?: string;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "email" | "createdAt" | "lastLoginAt";
  sortDir?: "asc" | "desc";
};

// Admin-panel accounts only — i.e. every user with a roleId assigned. Students (role='student',
// roleId always null) never appear here; this module never touches the student directory.
export async function listAdminUsers(opts: ListAdminUsersOpts = {}) {
  const d = requireDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const conds = [sql`${users.roleId} is not null`];
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    conds.push(or(ilike(users.name, q), ilike(users.email, q))!);
  }
  if (opts.roleId) conds.push(eq(users.roleId, opts.roleId));
  if (opts.status) conds.push(eq(users.status, opts.status));
  const where = and(...conds);

  const sortCol =
    opts.sortBy === "email"
      ? users.email
      : opts.sortBy === "lastLoginAt"
        ? users.lastLoginAt
        : opts.sortBy === "createdAt"
          ? users.createdAt
          : users.name;
  const orderExpr = opts.sortDir === "desc" ? desc(sortCol) : sortCol;

  const [rows, [{ n }]] = await Promise.all([
    d
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        roleId: users.roleId,
        roleName: roles.name,
        phone: users.phone,
        location: users.location,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(where)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    d.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { rows, total: n, page, pageSize };
}

export async function getAdminUserById(id: string) {
  const [row] = await requireDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      roleId: users.roleId,
      roleName: roles.name,
      phone: users.phone,
      location: users.location,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, id), sql`${users.roleId} is not null`));
  return row ?? null;
}

// Explicit column list — never includes passwordHash, so a leak here can't happen by omission.
const ADMIN_USER_SAFE_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  status: users.status,
  roleId: users.roleId,
  phone: users.phone,
  location: users.location,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastLoginAt: users.lastLoginAt,
};

export async function createAdminUser(input: AdminUserInput) {
  const d = requireDb();
  const email = input.email.trim().toLowerCase();
  const existing = await d.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) throw new ConflictError("A user with this email already exists.");
  const passwordHash = await bcrypt.hash(input.password!, 10);
  const [row] = await d
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      passwordHash,
      role: "admin",
      roleId: input.roleId,
      status: input.status ?? "active",
      phone: input.phone?.trim() || null,
      location: input.location || null,
    })
    .returning(ADMIN_USER_SAFE_COLUMNS);
  return row;
}

export async function updateAdminUser(
  id: string,
  patch: {
    name?: string;
    email?: string;
    roleId?: string;
    status?: "active" | "inactive";
    phone?: string | null;
    location?: string | null;
  }
) {
  const d = requireDb();
  if (patch.email) {
    const email = patch.email.trim().toLowerCase();
    const existing = await d
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), sql`${users.id} != ${id}`));
    if (existing.length > 0) throw new ConflictError("A user with this email already exists.");
  }
  const [row] = await d
    .update(users)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
      ...(patch.roleId !== undefined ? { roleId: patch.roleId } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone?.trim() || null } : {}),
      ...(patch.location !== undefined ? { location: patch.location || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning(ADMIN_USER_SAFE_COLUMNS);
  return row ?? null;
}

// Header stat cards for the Users screen — one lightweight aggregate query.
export async function getAdminUserStats() {
  const d = requireDb();
  const [row] = await d.execute<{
    total: number;
    active: number;
    inactive: number;
    admins_managers: number;
  }>(sql`
    select
      count(*)::int as total,
      count(*) filter (where u.status = 'active')::int as active,
      count(*) filter (where u.status = 'inactive')::int as inactive,
      count(*) filter (where r.slug in ('super-admin','admin','manager'))::int as admins_managers
    from users u
    left join roles r on r.id = u.role_id
    where u.role_id is not null
  `);
  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    inactive: row?.inactive ?? 0,
    adminsAndManagers: row?.admins_managers ?? 0,
  };
}

export async function deleteAdminUser(id: string) {
  await requireDb().delete(users).where(and(eq(users.id, id), sql`${users.roleId} is not null`));
}

// Generates and stores a one-time temporary password (no transactional email is wired up in
// this app yet), returned once to the admin to hand to the user out of band.
export async function resetAdminUserPassword(id: string) {
  const d = requireDb();
  const tempPassword = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await d.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
  return tempPassword;
}

// Number of active users currently holding a given (system) role — used to guard against
// deactivating/deleting/demoting the last remaining Super Admin.
export async function countActiveUsersInRole(roleId: string) {
  const [{ n }] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.roleId, roleId), eq(users.status, "active")));
  return n;
}

export async function recordAuditLog(entry: {
  userId: string | null;
  actorName: string;
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  try {
    await requireDb()
      .insert(auditLogs)
      .values({
        userId: entry.userId,
        actorName: entry.actorName,
        action: entry.action,
        module: entry.module,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        oldValues: entry.oldValues !== undefined ? JSON.stringify(entry.oldValues) : null,
        newValues: entry.newValues !== undefined ? JSON.stringify(entry.newValues) : null,
      });
  } catch (err) {
    // Audit logging must never break the primary action.
    console.error("[audit] failed to record entry:", err);
  }
}

export async function listAuditLogs(limit = 100) {
  return requireDb().select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
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

const JS_DAY_TO_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// How many concrete sessions a class actually runs between its start/end date, given its
// selected weekdays — mirrors the same computation the Classes admin form shows live. A
// one-off class (no `days`) always counts as exactly 1 session.
function countClassSessions(startDate: string | null, endDate: string | null, days: string | null): number {
  if (!days || !days.trim()) return startDate ? 1 : 0;
  if (!startDate || !endDate) return 0;
  const dayLabels = new Set(days.split(",").map((d) => d.trim()));
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (end < start) return 0;
  let n = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (dayLabels.has(JS_DAY_TO_LABEL[d.getDay()])) n++;
  }
  return n;
}

// Reports drill-down: every active class alongside how many concrete sessions it actually
// runs, not just the catalog count. "Active Classes" (the count) vs "Active Sessions" (the sum
// of real occurrences) are different numbers, and admins asked to see both.
export async function getActiveClassSessions(location?: string) {
  const d = requireDb();
  const rows = await d
    .select({
      id: classes.id,
      name: classes.name,
      category: classes.category,
      location: classes.location,
      mode: classes.mode,
      days: classes.days,
      startDate: classes.startDate,
      endDate: classes.endDate,
    })
    .from(classes)
    .where(location ? and(eq(classes.active, true), eq(classes.location, location)) : eq(classes.active, true))
    .orderBy(classes.name);

  const withCounts = rows.map((r) => ({
    ...r,
    sessionCount: countClassSessions(r.startDate, r.endDate, r.days),
  }));
  const totalSessions = withCounts.reduce((sum, r) => sum + r.sessionCount, 0);
  return { classes: withCounts, totalSessions };
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
export type DiscountScope = "all" | "category" | "class" | "event" | "workshop" | "studio";

export type DiscountInput = {
  name: string;
  code: string;
  type?: "percent" | "flat";
  percent?: number;
  flatAmount?: number;
  scope: DiscountScope;
  target?: string;
  validFrom?: string | null;
  validUntil?: string | null;
};

const SCOPES_WITHOUT_TARGET: DiscountScope[] = ["all", "studio"];

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
      target: SCOPES_WITHOUT_TARGET.includes(input.scope) ? null : input.target ?? null,
      validFrom: input.validFrom || null,
      validUntil: input.validUntil || null,
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
        ? { target: SCOPES_WITHOUT_TARGET.includes(patch.scope) ? null : patch.target ?? null }
        : patch.target !== undefined
          ? { target: patch.target ?? null }
          : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom || null } : {}),
      ...(patch.validUntil !== undefined ? { validUntil: patch.validUntil || null } : {}),
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
  eventId?: string;
  bookingType?: "class" | "workshop" | "event" | "studio";
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
  if ((disc.scope === "event" || disc.scope === "workshop") && disc.target !== opts.eventId) return null;
  if (disc.scope === "studio" && opts.bookingType !== "studio") return null;
  const today = new Date().toISOString().slice(0, 10);
  if (disc.validFrom && today < disc.validFrom) return null;
  if (disc.validUntil && today > disc.validUntil) return null;
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

// ───────────── Plans (admin-managed pricing) ─────────────
/** Active plans only — what students and Book on Behalf can pick. */
export async function listPlans() {
  return requireDb().select().from(plans).where(eq(plans.active, true));
}

/** Every plan, including inactive ones — for the admin Plans screen. */
export async function listAllPlans() {
  return requireDb().select().from(plans);
}

const planCode = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plan";

/** Returns null when a plan with the same code (derived from the name) already exists. */
export async function createPlan(input: Pick<PlanInput, "name" | "interval" | "price"> & Partial<PlanInput>) {
  const [row] = await requireDb()
    .insert(plans)
    .values({
      code: planCode(input.name),
      name: input.name.trim(),
      interval: input.interval,
      price: input.price,
      description: input.description ?? null,
      active: input.active ?? true,
    })
    .onConflictDoNothing({ target: plans.code })
    .returning();
  return row ?? null;
}

export async function updatePlan(id: string, patch: Partial<PlanInput>) {
  const d = requireDb();
  if (Object.keys(patch).length === 0) {
    const [row] = await d.select().from(plans).where(eq(plans.id, id));
    return row ?? null;
  }
  const [row] = await d.update(plans).set(patch).where(eq(plans.id, id)).returning();
  return row ?? null;
}

export async function deletePlan(id: string) {
  await requireDb().delete(plans).where(eq(plans.id, id));
}

// ───────────── Portal Settings (admin-managed key/value config) ─────────────
export type PortalSettings = {
  studioHourlyRate: number;
  studioPurposes: string[];
  demoClassTypes: string[];
};

// Used until an admin saves a value on Portal Settings.
const PORTAL_SETTING_DEFAULTS: PortalSettings = {
  studioHourlyRate: 600,
  studioPurposes: [
    "Personal Practice",
    "Group Rehearsal",
    "Private Rehearsal",
    "Performance Practice",
    "Photo / Video Shoot",
  ],
  demoClassTypes: ["Group Class", "Private Class", "Trial Class"],
};

const SETTING_KEYS: Record<keyof PortalSettings, string> = {
  studioHourlyRate: "studio.hourly_rate",
  studioPurposes: "studio.purposes",
  demoClassTypes: "demo.class_types",
};

export async function getPortalSettings(): Promise<PortalSettings> {
  const rows = await requireDb().select().from(appSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const read = <K extends keyof PortalSettings>(k: K): PortalSettings[K] => {
    const raw = byKey.get(SETTING_KEYS[k]);
    if (raw === undefined) return PORTAL_SETTING_DEFAULTS[k];
    try {
      return JSON.parse(raw) as PortalSettings[K];
    } catch {
      return PORTAL_SETTING_DEFAULTS[k];
    }
  };
  return {
    studioHourlyRate: read("studioHourlyRate"),
    studioPurposes: read("studioPurposes"),
    demoClassTypes: read("demoClassTypes"),
  };
}

export async function updatePortalSettings(patch: Partial<PortalSettings>) {
  const d = requireDb();
  for (const k of Object.keys(patch) as (keyof PortalSettings)[]) {
    if (patch[k] === undefined) continue;
    const value = JSON.stringify(patch[k]);
    await d
      .insert(appSettings)
      .values({ key: SETTING_KEYS[k], value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }
  return getPortalSettings();
}

// ───────────── Swish certificate (uploaded from Portal Settings) ─────────────
// Stored in app_settings under keys that are never part of PortalSettings, so the
// public /api/settings GET can't reach them. Certificate, key and passphrase are
// encrypted; only the non-secret metadata is stored in plain JSON.

export type SwishCertificateMeta = {
  subject: string; // certificate CN — Swish puts the merchant number here
  issuer: string;
  validFrom: string; // ISO
  validTo: string; // ISO
  fingerprint: string; // SHA-256
  uploadedAt: string; // ISO
  uploadedBy: string;
};

const SWISH_CERT_KEYS = {
  cert: "swish.cert",
  key: "swish.key",
  passphrase: "swish.key_pass",
  meta: "swish.cert_meta",
} as const;

export async function getSwishCertificateMeta(): Promise<SwishCertificateMeta | null> {
  const [row] = await requireDb().select().from(appSettings).where(eq(appSettings.key, SWISH_CERT_KEYS.meta));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SwishCertificateMeta;
  } catch {
    return null;
  }
}

/** Decrypted certificate + key for the Swish client, or null when none has been uploaded. */
export async function getSwishCertificate(): Promise<{ cert: string; key: string; passphrase: string | null } | null> {

  const rows = await requireDb()
    .select()
    .from(appSettings)
    .where(or(eq(appSettings.key, SWISH_CERT_KEYS.cert), eq(appSettings.key, SWISH_CERT_KEYS.key), eq(appSettings.key, SWISH_CERT_KEYS.passphrase)));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const cert = byKey.get(SWISH_CERT_KEYS.cert);
  const key = byKey.get(SWISH_CERT_KEYS.key);
  if (!cert || !key) return null;
  const pass = byKey.get(SWISH_CERT_KEYS.passphrase);
  return {
    cert: decryptSecret(cert),
    key: decryptSecret(key),
    passphrase: pass ? decryptSecret(pass) : null,
  };
}

export async function saveSwishCertificate(input: {
  cert: string;
  key: string;
  passphrase: string | null;
  meta: SwishCertificateMeta;
}) {

  const now = new Date();
  const values = [
    { key: SWISH_CERT_KEYS.cert, value: encryptSecret(input.cert) },
    { key: SWISH_CERT_KEYS.key, value: encryptSecret(input.key) },
    { key: SWISH_CERT_KEYS.meta, value: JSON.stringify(input.meta) },
    ...(input.passphrase ? [{ key: SWISH_CERT_KEYS.passphrase, value: encryptSecret(input.passphrase) }] : []),
  ];
  await requireDb().transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(appSettings)
        .values({ ...v, updatedAt: now })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: v.value, updatedAt: now } });
    }
    // A new key without a passphrase must not inherit the old one's.
    if (!input.passphrase) await tx.delete(appSettings).where(eq(appSettings.key, SWISH_CERT_KEYS.passphrase));
  });
}

export async function deleteSwishCertificate() {
  await requireDb()
    .delete(appSettings)
    .where(
      or(
        eq(appSettings.key, SWISH_CERT_KEYS.cert),
        eq(appSettings.key, SWISH_CERT_KEYS.key),
        eq(appSettings.key, SWISH_CERT_KEYS.passphrase),
        eq(appSettings.key, SWISH_CERT_KEYS.meta),
      ),
    );
}

// ───────────── Catalog ─────────────
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

/**
 * Students who created an account (via /register or Google) but haven't
 * completed a class/workshop/studio booking yet — surfaced as enquiries too,
 * alongside standalone "Book a Demo" leads, so admin sees everyone who
 * showed interest but hasn't taken a service.
 */
export async function listUnconvertedSignups() {
  const d = requireDb();
  return d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      city: users.city,
      country: users.country,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "student"),
        sql`not exists (select 1 from ${registrations} r where r.email = ${users.email})`
      )
    )
    .orderBy(desc(users.createdAt));
}

// ───────────── Email templates + delivery log ─────────────

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;

/** Admin-edited templates only — keys without a row use the built-in default. */
export async function listEmailTemplateOverrides() {
  return requireDb().select().from(emailTemplates);
}

export async function getEmailTemplateOverride(key: string) {
  const [row] = await requireDb().select().from(emailTemplates).where(eq(emailTemplates.key, key));
  return row ?? null;
}

export async function saveEmailTemplate(input: {
  key: string;
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
  enabled: boolean;
  updatedBy: string;
}) {
  const values = { ...input, updatedAt: new Date() };
  const [row] = await requireDb()
    .insert(emailTemplates)
    .values(values)
    .onConflictDoUpdate({ target: emailTemplates.key, set: values })
    .returning();
  return row;
}

/** Drops the admin's edits so the built-in default is used again. */
export async function resetEmailTemplate(key: string) {
  await requireDb().delete(emailTemplates).where(eq(emailTemplates.key, key));
}

/**
 * Reserves a send in the log. With a dedupeKey, returns null when that email
 * was already sent (or is being sent right now) — so a booking confirmed by
 * both the Swish callback and the result page is only emailed once.
 */
export async function claimEmailLog(entry: {
  templateKey: string;
  toEmail: string;
  subject: string;
  dedupeKey?: string | null;
}) {
  const [row] = await requireDb()
    .insert(emailLog)
    .values({ ...entry, dedupeKey: entry.dedupeKey ?? null, status: "sending" })
    .onConflictDoNothing({ target: emailLog.dedupeKey })
    .returning({ id: emailLog.id });
  return row ?? null;
}

/** A failed send frees its dedupe key so the next trigger can try again. */
export async function finishEmailLog(id: string, status: "sent" | "failed" | "logged", error?: string | null) {
  await requireDb()
    .update(emailLog)
    .set(status === "failed" ? { status, error: error ?? null, dedupeKey: null } : { status, error: null })
    .where(eq(emailLog.id, id));
}

export async function listEmailLog(limit = 30) {
  return requireDb().select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(limit);
}

const ADMIN_EMAIL_RECIPIENTS_KEY = "email_admin_recipients";

/** Addresses that get the "new booking" email: the admin panel's list, else EMAIL_ADMIN_TO. */
export async function getAdminEmailRecipients(): Promise<{ emails: string[]; source: "settings" | "env" | "none" }> {
  const [row] = await requireDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, ADMIN_EMAIL_RECIPIENTS_KEY));
  const parse = (v: string) =>
    v
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  if (row && parse(row.value).length) return { emails: parse(row.value), source: "settings" };
  const env = parse(process.env.EMAIL_ADMIN_TO ?? "");
  return env.length ? { emails: env, source: "env" } : { emails: [], source: "none" };
}

export async function setAdminEmailRecipients(emails: string[]) {
  if (!emails.length) {
    await requireDb().delete(appSettings).where(eq(appSettings.key, ADMIN_EMAIL_RECIPIENTS_KEY));
    return;
  }
  const value = emails.join(", ");
  await requireDb()
    .insert(appSettings)
    .values({ key: ADMIN_EMAIL_RECIPIENTS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

export async function getUserPhone(email: string) {
  const [row] = await requireDb()
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  return row?.phone ?? null;
}
