import bcrypt from "bcryptjs";
import { and, desc, eq, getTableColumns, gt, ilike, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
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
  vatRates,
  customerStatusLog,
  waitlist,
  type WaitlistRow,
  invoices,
  bulkMessages,
  promotions,
  paymentReminders,
} from "@/lib/db/schema";
import type { CustomerAction } from "@/lib/customers";
import { hasRequiredConsent, type ConsentChoices } from "@/lib/consent";
import { invalidateAdminActorCache } from "@/lib/auth/actorCache";
import type { StudentImportRow as ImportedStudent } from "@/lib/studentImport";

type StudentImportRow = ImportedStudent & { line?: number };
import { planTotal, type PlanInput } from "@/lib/plans";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { applyVat, DEFAULT_VAT_RULES, vatRuleFor, type VatBookingType, type VatBreakdown, type VatMode, type VatRule } from "@/lib/vat";

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
  /** Version of the GDPR wording they agreed to at signup (lib/consent.ts). */
  consentVersion?: string;
  /** Which permissions they ticked — data (required), photo, video, promo. */
  consentChoices?: ConsentChoices;
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
  const consent = input.consentVersion
    ? consentColumns(input.consentChoices ?? { data: true, photo: false, video: false, promo: false }, input.consentVersion)
    : {};
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
    ...consent,
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
        ...consent,
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
  /** Promotion link the customer arrived through (online bookings). */
  promotionId?: string | null;
};

/** Longest customer note stored with a booking. */
export const BOOKING_NOTES_MAX = 500;

export type CreateRegistrationResult = Awaited<ReturnType<typeof insertRegistration>>;

async function insertRegistration(
  input: RegistrationInput,
  price: VatBreakdown,
  appliedCode: string | null,
  discount: { base: number; amount: number } = { base: price.net, amount: 0 }
) {
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
    amount: price.total,
    vatRateBp: price.rateBp,
    vatMode: price.mode,
    vatAmount: price.vat,
    netAmount: price.net,
    discountCode: appliedCode,
    baseAmount: discount.base,
    discountAmount: discount.amount,
    eventId: input.eventId ?? null,
    classId: input.classId || null,
    promotionId: input.promotionId || null,
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

  // Booking from the waitlist closes their place in line.
  if (row.classId || row.eventId) {
    await markWaitlistBooked({ email: row.email, classId: row.classId, eventId: row.eventId, bookingId: row.id }).catch((err) =>
      console.error(`[waitlist] couldn't close entry for ${row.id}:`, err)
    );
  }

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

  // VAT goes on the discounted price, per the VAT master for this booking type.
  const rule = vatRuleFor(await listVatRules(), input.type);
  return insertRegistration(input, applyVat(amount, rule), appliedCode, { base, amount: Math.max(0, base - amount) });
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

// ───────────── Importing students from a spreadsheet ─────────────

export type ImportPlanRow = {
  line: number;
  email: string;
  name: string;
  action: "create" | "update";
  /** Which fields an update would actually change. */
  changes: string[];
};

/**
 * Works out what an import would do, without writing anything: which rows are
 * new students, which update an existing one, and exactly which fields change.
 * The admin sees this before anything is saved.
 */
export async function planStudentImport(rows: StudentImportRow[]): Promise<ImportPlanRow[]> {
  if (rows.length === 0) return [];
  const d = requireDb();
  const emails = rows.map((r) => r.email);
  const existing = await d
    .select({
      email: users.email,
      name: users.name,
      phone: users.phone,
      dob: users.dob,
      gender: users.gender,
      city: users.city,
      country: users.country,
      location: users.location,
      notes: users.notes,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.email, emails));
  const byEmail = new Map(existing.map((e) => [e.email, e]));

  return rows.map((r) => {
    const found = byEmail.get(r.email);
    if (!found) return { line: r.line ?? 0, email: r.email, name: r.name, action: "create" as const, changes: [] };
    const changes: string[] = [];
    const check = (label: string, next: string | null, now: string | null) => {
      if (next !== null && next !== "" && next !== now) changes.push(label);
    };
    check("Name", r.name, found.name);
    check("Phone", r.phone, found.phone);
    check("Date of birth", r.dob, found.dob);
    check("Gender", r.gender, found.gender);
    check("City", r.city, found.city);
    check("Country", r.country, found.country);
    check("Location", r.location, found.location);
    check("Notes", r.notes, found.notes);
    return { line: r.line ?? 0, email: r.email, name: r.name, action: "update" as const, changes };
  });
}

/**
 * Writes the rows. Students are matched on email: an existing one is updated
 * (blank cells never erase what's on record) and a new email is created.
 *
 * Imported students are deliberately left **without GDPR consent** — consent
 * has to be given by the person, not typed into a spreadsheet, so they're asked
 * the first time they book. Admin-panel accounts are never touched.
 */
export async function importStudents(rows: (StudentImportRow & { line?: number })[]) {
  if (rows.length === 0) return { created: 0, updated: 0, skipped: 0, skippedEmails: [] as string[] };
  const d = requireDb();

  // Home studio flags, so an imported location looks like one picked in the app.
  const locs = await d.select({ label: locations.label, flag: locations.flag }).from(locations);
  const flagFor = (label: string | null) =>
    label ? locs.find((l) => l.label.toLowerCase() === label.toLowerCase())?.flag ?? null : null;

  const existing = await d
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.email, rows.map((r) => r.email)));
  const roleByEmail = new Map(existing.map((e) => [e.email, e.role]));

  const today = new Date();
  let created = 0;
  let updated = 0;
  const skippedEmails: string[] = [];

  for (const r of rows) {
    const role = roleByEmail.get(r.email);
    // Never rewrite an admin / coach account from a student spreadsheet.
    if (role && role !== "student") {
      skippedEmails.push(r.email);
      continue;
    }
    const age = r.dob ? Math.max(0, Math.floor((today.getTime() - new Date(r.dob).getTime()) / 31_557_600_000)) : null;
    // Only the columns that actually carry a value — a blank cell leaves the
    // stored value alone.
    const patch = {
      ...(r.name ? { name: r.name } : {}),
      ...(r.phone ? { phone: r.phone } : {}),
      ...(r.dob ? { dob: r.dob, age } : {}),
      ...(r.gender ? { gender: r.gender } : {}),
      ...(r.city ? { city: r.city } : {}),
      ...(r.country ? { country: r.country } : {}),
      ...(r.location ? { location: r.location, flag: flagFor(r.location) } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
      updatedAt: new Date(),
    };

    if (role === "student") {
      await d.update(users).set(patch).where(eq(users.email, r.email));
      updated += 1;
    } else {
      await d.insert(users).values({
        name: r.name,
        email: r.email,
        role: "student",
        phone: r.phone,
        dob: r.dob,
        age,
        gender: r.gender,
        city: r.city,
        country: r.country,
        location: r.location,
        flag: flagFor(r.location),
        notes: r.notes,
      });
      created += 1;
    }
  }

  return { created, updated, skipped: skippedEmails.length, skippedEmails };
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
  // A paused / dropped-off customer who pays for a new booking is back.
  if (row) await autoResumeCustomer(row.email, row.id);
  // Issue the invoice now so it's numbered in payment order.
  if (row) await ensureInvoice(row.id).catch((err) => console.error(`[invoice] couldn't issue for ${row.id}:`, err));
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
  const dates = (period ?? "").match(/\d{4}-\d{2}-\d{2}/g);
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
  // seats_total − seats_left is the seats taken outside the app; changing the
  // total must not change that, so move seats_left by the same amount.
  let seatsLeftPatch = {};
  if (patch.seatsTotal !== undefined) {
    const [cur] = await d.select({ seatsTotal: events.seatsTotal, seatsLeft: events.seatsLeft }).from(events).where(eq(events.id, id));
    if (cur) {
      const total = Number(patch.seatsTotal) || 0;
      seatsLeftPatch = { seatsLeft: Math.max(0, cur.seatsLeft + (total - cur.seatsTotal)) };
    }
  }
  const [ev] = await d.update(events).set({ ...patch, ...seatsLeftPatch }).where(eq(events.id, id)).returning();
  return ev;
}

export async function deleteEvent(id: string) {
  await requireDb().delete(events).where(eq(events.id, id));
}

export async function listEvents() {
  return withLiveEventSeats(await requireDb().select().from(events).orderBy(desc(events.createdAt)));
}

/**
 * Replaces the stored seats_left (never decremented by bookings) with the real
 * number of seats left: capacity − seats taken outside the app − live bookings
 * − seats held for the waitlist.
 */
export async function withLiveEventSeats<T extends { id: string; seatsTotal: number; seatsLeft: number }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const { map } = await getSeatMap();
  return rows.map((r) => {
    const s = map.get(r.id);
    return s && s.capacity > 0 ? { ...r, seatsLeft: s.left } : r;
  });
}

/** Active classes with their live seat counts, for booking pages. */
export async function listClassesWithSeats() {
  const [rows, { map }] = await Promise.all([listClasses(), getSeatMap()]);
  // Public list: Zoom links are only for students who booked (see getMyZoomLinks).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return rows.map(({ zoomJoinUrl, zoomPassword, zoomMeetingId, zoomError, zoomSyncedAt, ...c }) => ({
    ...c,
    hasZoom: Boolean(zoomJoinUrl),
    seats: seatJson(map.get(c.id)),
  }));
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
      // Prefills the Swish number when an admin books on their behalf.
      phone: users.phone,
      customerStatus: users.customerStatus,
      blacklisted: users.blacklisted,
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
  invalidateAdminActorCache();
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
  invalidateAdminActorCache();
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
  // So the new permissions apply on the very next request, not seconds later.
  invalidateAdminActorCache();
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
  invalidateAdminActorCache();
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
  invalidateAdminActorCache();
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
  /** "demo" (Book a Demo) or "workshop" (a question about a workshop / event). */
  kind?: "demo" | "workshop";
  eventId?: string | null;
  promotionId?: string | null;
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
      kind: input.kind ?? "demo",
      eventId: input.eventId || null,
      promotionId: input.promotionId || null,
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


// ───────────── VAT master ─────────────

/** All four rules — saved ones, with the built-in default for any never saved. */
export async function listVatRules(): Promise<(VatRule & { updatedBy: string | null; updatedAt: Date | null })[]> {
  const rows = await requireDb().select().from(vatRates);
  const byType = new Map(rows.map((r) => [r.bookingType, r]));
  return DEFAULT_VAT_RULES.map((def) => {
    const r = byType.get(def.bookingType);
    return r
      ? {
          bookingType: def.bookingType,
          rateBp: r.rateBp,
          mode: (r.mode === "exclusive" ? "exclusive" : "inclusive") as VatMode,
          active: r.active,
          updatedBy: r.updatedBy,
          updatedAt: r.updatedAt,
        }
      : { ...def, updatedBy: null, updatedAt: null };
  });
}

export async function saveVatRules(rules: VatRule[], updatedBy: string) {
  const d = requireDb();
  const now = new Date();
  await d.transaction(async (tx) => {
    for (const r of rules) {
      const values = {
        bookingType: r.bookingType as VatBookingType,
        rateBp: r.rateBp,
        mode: r.mode,
        active: r.active,
        updatedBy,
        updatedAt: now,
      };
      await tx
        .insert(vatRates)
        .values(values)
        .onConflictDoUpdate({ target: vatRates.bookingType, set: values });
    }
  });
  return listVatRules();
}

// ───────────── Customers (status, drop-off reasons, resume) ─────────────

/**
 * A booking the customer still owes money on: an admin booking sent as a
 * payment link / marked overdue. A Stripe or Swish checkout that's pending is
 * just someone at the payment page (or who walked away), not a debt.
 */
const UNPAID_SQL = sql`(${registrations.status} <> ${PAYMENT_CANCELLED_STATUS} and (${registrations.paid} = 'overdue' or (${registrations.paid} = 'pending' and (${registrations.paymentMethod} is null or ${registrations.paymentMethod} not in ('stripe', 'swish')))))`;

/** Every student with their status, booking counts and money owed — one row each. */
export async function listCustomers() {
  const d = requireDb();
  const [people, stats] = await Promise.all([
    d
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        location: users.location,
        flag: users.flag,
        customerStatus: users.customerStatus,
        blacklisted: users.blacklisted,
        statusReason: users.statusReason,
        statusNote: users.statusNote,
        statusChangedAt: users.statusChangedAt,
        createdAt: users.createdAt,
        gdprConsentAt: users.gdprConsentAt,
        gdprConsentVersion: users.gdprConsentVersion,
        mediaConsent: users.mediaConsent,
        dataConsent: users.dataConsent,
        photoConsent: users.photoConsent,
        videoConsent: users.videoConsent,
        promoConsent: users.promoConsent,
        mediaConsentWithdrawnAt: users.mediaConsentWithdrawnAt,
      })
      .from(users)
      .where(eq(users.role, "student"))
      .orderBy(desc(users.createdAt)),
    d
      .select({
        email: registrations.email,
        bookings: sql<number>`count(*) filter (where ${registrations.status} <> ${PAYMENT_CANCELLED_STATUS})::int`,
        classes: sql<number>`count(*) filter (where ${registrations.type} = 'class' and ${registrations.status} <> ${PAYMENT_CANCELLED_STATUS})::int`,
        paidTotal: sql<number>`coalesce(sum(${registrations.amount}) filter (where ${registrations.paid} = 'paid'), 0)::int`,
        unpaidCount: sql<number>`count(*) filter (where ${UNPAID_SQL})::int`,
        unpaidAmount: sql<number>`coalesce(sum(${registrations.amount}) filter (where ${UNPAID_SQL}), 0)::int`,
        lastBookingAt: sql<Date | null>`max(${registrations.createdAt})`,
      })
      .from(registrations)
      .groupBy(registrations.email),
  ]);
  const byEmail = new Map(stats.map((s) => [s.email, s]));
  return people.map((p) => {
    const s = byEmail.get(p.email);
    return {
      ...p,
      bookings: s?.bookings ?? 0,
      classes: s?.classes ?? 0,
      paidTotal: s?.paidTotal ?? 0,
      unpaidCount: s?.unpaidCount ?? 0,
      unpaidAmount: s?.unpaidAmount ?? 0,
      lastBookingAt: s?.lastBookingAt ?? null,
    };
  });
}

/** One customer's full record: profile, status, status history and every booking. */
export async function getCustomerDetail(id: string) {
  const d = requireDb();
  const [person] = await d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      city: users.city,
      country: users.country,
      location: users.location,
      flag: users.flag,
      age: users.age,
      customerStatus: users.customerStatus,
      blacklisted: users.blacklisted,
      statusReason: users.statusReason,
      statusNote: users.statusNote,
      statusChangedAt: users.statusChangedAt,
      createdAt: users.createdAt,
      // GDPR: when they agreed, to which wording, and whether photos / videos
      // are still allowed.
      gdprConsentAt: users.gdprConsentAt,
      gdprConsentVersion: users.gdprConsentVersion,
      mediaConsent: users.mediaConsent,
      dataConsent: users.dataConsent,
      photoConsent: users.photoConsent,
      videoConsent: users.videoConsent,
      promoConsent: users.promoConsent,
      mediaConsentWithdrawnAt: users.mediaConsentWithdrawnAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "student")));
  if (!person) return null;
  const [history, bookings] = await Promise.all([
    d
      .select()
      .from(customerStatusLog)
      .where(eq(customerStatusLog.userId, id))
      .orderBy(desc(customerStatusLog.createdAt)),
    d
      .select({
        id: registrations.id,
        type: registrations.type,
        detail: registrations.detail,
        period: registrations.period,
        plan: registrations.plan,
        location: registrations.location,
        amount: registrations.amount,
        paid: registrations.paid,
        paymentMethod: registrations.paymentMethod,
        status: registrations.status,
        statusTone: registrations.statusTone,
        discountCode: registrations.discountCode,
        createdAt: registrations.createdAt,
        unpaid: sql<boolean>`${UNPAID_SQL}`,
      })
      .from(registrations)
      .where(eq(registrations.email, person.email))
      .orderBy(desc(registrations.createdAt)),
  ]);
  return { ...person, history, bookings };
}

export class CustomerStatusError extends Error {}

/**
 * Pause, drop, resume or (un)blacklist a customer. The customer keeps the same
 * record the whole time — bookings and payments are linked by email, so a
 * resumed student comes back with their full history, never a new profile.
 */
export async function updateCustomerStatus(input: {
  id: string;
  action: CustomerAction;
  reasonCode?: string | null;
  note?: string | null;
  actorName: string;
}) {
  const d = requireDb();
  const [current] = await d
    .select({ id: users.id, customerStatus: users.customerStatus, blacklisted: users.blacklisted })
    .from(users)
    .where(and(eq(users.id, input.id), eq(users.role, "student")));
  if (!current) return null;

  const note = String(input.note ?? "").trim().slice(0, 500) || null;
  const reasonCode = String(input.reasonCode ?? "").trim() || null;
  const from = current.customerStatus;
  let set: Partial<typeof users.$inferInsert>;

  switch (input.action) {
    case "paused":
    case "dropped": {
      if (!reasonCode) throw new CustomerStatusError("Choose a reason.");
      set = { customerStatus: input.action === "paused" ? "paused" : "dropped", statusReason: reasonCode, statusNote: note };
      break;
    }
    case "resumed": {
      if (from === "active") throw new CustomerStatusError("This customer is already active.");
      set = { customerStatus: "active", statusReason: null, statusNote: note };
      break;
    }
    case "blacklisted": {
      if (current.blacklisted) throw new CustomerStatusError("This customer is already blacklisted.");
      if (!reasonCode) throw new CustomerStatusError("Choose a reason.");
      set = { blacklisted: true, statusReason: reasonCode, statusNote: note };
      break;
    }
    case "unblacklisted": {
      if (!current.blacklisted) throw new CustomerStatusError("This customer isn't blacklisted.");
      set = { blacklisted: false, statusReason: null, statusNote: note };
      break;
    }
    default:
      throw new CustomerStatusError("Unknown action.");
  }

  const now = new Date();
  await d.transaction(async (tx) => {
    await tx.update(users).set({ ...set, statusChangedAt: now, updatedAt: now }).where(eq(users.id, input.id));
    await tx.insert(customerStatusLog).values({
      userId: input.id,
      action: input.action,
      fromStatus: from,
      toStatus: set.customerStatus ?? from,
      reasonCode,
      note,
      actorName: input.actorName,
    });
  });
  return getCustomerDetail(input.id);
}

/**
 * A paused or dropped-off customer who books again is back — switch them to
 * active on their original record and note which booking brought them back.
 * Never throws: a booking must not fail because of this bookkeeping.
 */
export async function autoResumeCustomer(email: string, bookingId: string) {
  try {
    const d = requireDb();
    const [row] = await d
      .select({ id: users.id, customerStatus: users.customerStatus })
      .from(users)
      .where(and(eq(users.email, email.trim().toLowerCase()), eq(users.role, "student")));
    if (!row || row.customerStatus === "active") return;
    const now = new Date();
    await d.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ customerStatus: "active", statusReason: null, statusNote: null, statusChangedAt: now, updatedAt: now })
        .where(eq(users.id, row.id));
      await tx.insert(customerStatusLog).values({
        userId: row.id,
        action: "resumed",
        fromStatus: row.customerStatus,
        toStatus: "active",
        bookingId,
        note: `Resumed automatically by new booking ${bookingId}`,
      });
    });
  } catch (err) {
    console.error(`[customers] auto-resume for booking ${bookingId} failed:`, err);
  }
}

/** Blocks new bookings for a blacklisted customer. */
export class CustomerBlacklistedError extends Error {}

export async function assertCustomerCanBook(email: string) {
  const [row] = await requireDb()
    .select({ blacklisted: users.blacklisted })
    .from(users)
    .where(eq(users.email, String(email ?? "").trim().toLowerCase()));
  if (row?.blacklisted) {
    throw new CustomerBlacklistedError(
      "We can't take this booking online. Please contact Anchor Dance & Fitness for help."
    );
  }
}

// ───────────── Seat capacity & waitlist ─────────────

/** How long a freed seat is held for the waitlisted person it was offered to. */
export const WAITLIST_OFFER_HOURS = 24;

export type SeatTarget = { kind: "class" | "event"; id: string };

export function seatTargetOf(input: { type?: string | null; classId?: string | null; eventId?: string | null }): SeatTarget | null {
  if ((input.type === "workshop" || input.type === "event") && input.eventId) return { kind: "event", id: input.eventId };
  if (input.type === "class" && input.classId) return { kind: "class", id: input.classId };
  return null;
}

/**
 * Live seats in use: bookings that still hold a place (same rule as the
 * duplicate check — not cancelled, not an abandoned checkout, class term not
 * over) plus seats held for a waitlisted person who's been offered one.
 */
async function seatUsage() {
  const d = requireDb();
  const holdSince = new Date(Date.now() - PAYMENT_HOLD_MS);
  const [rows, offers] = await Promise.all([
    d
      .select({ type: registrations.type, classId: registrations.classId, eventId: registrations.eventId, period: registrations.period })
      .from(registrations)
      .where(
        and(
          or(sql`${registrations.classId} is not null`, sql`${registrations.eventId} is not null`),
          sql`${registrations.status} <> ${PAYMENT_CANCELLED_STATUS}`,
          or(sql`${registrations.paid} <> 'pending'`, isNull(registrations.paymentMethod), gt(registrations.createdAt, holdSince))
        )
      ),
    d
      .select({ classId: waitlist.classId, eventId: waitlist.eventId, email: waitlist.email })
      .from(waitlist)
      .where(and(eq(waitlist.status, "offered"), gt(waitlist.offerExpiresAt, new Date()))),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const booked = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "class") {
      if (!r.classId) continue;
      const end = periodEnd(r.period);
      if (end && end < today) continue;
      booked.set(r.classId, (booked.get(r.classId) ?? 0) + 1);
    } else if (r.eventId) {
      booked.set(r.eventId, (booked.get(r.eventId) ?? 0) + 1);
    }
  }
  const held = new Map<string, string[]>();
  for (const o of offers) {
    const id = o.classId ?? o.eventId;
    if (id) held.set(id, [...(held.get(id) ?? []), o.email]);
  }
  return { booked, held };
}

export type SeatInfo = {
  capacity: number; // 0 = no limit
  booked: number; // live bookings (+ seats an admin recorded as taken outside the app, for events)
  held: number; // offered to someone on the waitlist
  left: number;
  full: boolean;
};

function seatInfo(capacity: number, booked: number, held: number): SeatInfo {
  if (capacity <= 0) return { capacity: 0, booked, held, left: Number.POSITIVE_INFINITY, full: false };
  const left = Math.max(0, capacity - booked - held);
  return { capacity, booked, held, left, full: left <= 0 };
}

/**
 * Events keep `seats_total - seats_left` as seats taken outside the app (it was
 * never decremented by bookings, so it's whatever the admin set up). Live
 * bookings are counted on top of that.
 */
function eventOfflineSeats(e: { seatsTotal: number; seatsLeft: number }) {
  return Math.max(0, e.seatsTotal - e.seatsLeft);
}

/** Seat info for every active class and every event, keyed by id. */
export async function getSeatMap() {
  const d = requireDb();
  const [{ booked, held }, classRows, eventRows] = await Promise.all([
    seatUsage(),
    d.select({ id: classes.id, capacity: classes.capacity }).from(classes),
    d.select({ id: events.id, seatsTotal: events.seatsTotal, seatsLeft: events.seatsLeft }).from(events),
  ]);
  const map = new Map<string, SeatInfo>();
  for (const c of classRows) map.set(c.id, seatInfo(c.capacity, booked.get(c.id) ?? 0, held.get(c.id)?.length ?? 0));
  for (const e of eventRows)
    map.set(e.id, seatInfo(e.seatsTotal, eventOfflineSeats(e) + (booked.get(e.id) ?? 0), held.get(e.id)?.length ?? 0));
  return { map, held };
}

/** JSON-safe seat info (Infinity → null) for API responses. */
export function seatJson(s: SeatInfo | undefined) {
  if (!s) return null;
  return { ...s, left: Number.isFinite(s.left) ? s.left : null };
}

export class SeatsFullError extends Error {
  constructor(
    message: string,
    readonly target: SeatTarget
  ) {
    super(message);
  }
}

/**
 * Stops a booking once a class / workshop / event is full. A person holding a
 * waitlist offer for it may still book — the held seat is theirs.
 */
export async function assertSeatAvailable(input: { type?: string | null; classId?: string | null; eventId?: string | null; email: string }) {
  const target = seatTargetOf(input);
  if (!target) return;
  const { map, held } = await getSeatMap();
  const info = map.get(target.id);
  if (!info || !info.full) return;
  const email = input.email.trim().toLowerCase();
  if (held.get(target.id)?.includes(email)) return; // their offered seat
  const what = target.kind === "class" ? "class" : input.type === "event" ? "event" : "workshop";
  throw new SeatsFullError(`Sorry — this ${what} is full. Join the waitlist and we'll email you as soon as a seat opens up.`, target);
}

export class WaitlistError extends Error {}

/** Adds someone to the waitlist of a full class / workshop / event. Returns their entry and place in line. */
export async function joinWaitlist(input: {
  type: "class" | "workshop" | "event";
  classId?: string | null;
  eventId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
}) {
  const d = requireDb();
  const target = seatTargetOf(input);
  if (!target) throw new WaitlistError("Choose a class, workshop or event.");
  const email = input.email.trim().toLowerCase();

  const { map } = await getSeatMap();
  const info = map.get(target.id);
  if (!info) throw new WaitlistError("That class or event is no longer available.");
  if (!info.full) throw new WaitlistError("Good news — there are seats left, so you can book it straight away.");
  if (await findActiveDuplicate({ email, type: input.type, classId: input.classId, eventId: input.eventId }))
    throw new WaitlistError("You've already booked this.");

  const col = target.kind === "class" ? waitlist.classId : waitlist.eventId;
  const [existing] = await d
    .select()
    .from(waitlist)
    .where(and(eq(col, target.id), eq(waitlist.email, email), sql`${waitlist.status} in ('waiting', 'offered')`));
  const entry =
    existing ??
    (
      await d
        .insert(waitlist)
        .values({
          type: input.type,
          classId: target.kind === "class" ? target.id : null,
          eventId: target.kind === "event" ? target.id : null,
          name: input.name.trim() || email,
          email,
          phone: input.phone?.trim() || null,
        })
        .returning()
    )[0];
  const [{ ahead }] = await d
    .select({ ahead: sql<number>`count(*)::int` })
    .from(waitlist)
    .where(and(eq(col, target.id), eq(waitlist.status, "waiting"), entry.createdAt ? lt(waitlist.createdAt, entry.createdAt) : sql`false`));
  return { entry, position: ahead + 1, already: Boolean(existing) };
}

/** A person leaves a waitlist themselves (only their own entry). */
export async function leaveWaitlist(id: string, email: string) {
  const [row] = await requireDb()
    .update(waitlist)
    .set({ status: "removed" })
    .where(and(eq(waitlist.id, id), eq(waitlist.email, email.trim().toLowerCase()), sql`${waitlist.status} in ('waiting', 'offered')`))
    .returning();
  return row ?? null;
}

/** Admin removes an entry. */
export async function removeWaitlistEntry(id: string) {
  const [row] = await requireDb().update(waitlist).set({ status: "removed" }).where(eq(waitlist.id, id)).returning();
  return row ?? null;
}

/** Everyone currently waiting on (or offered) a class / event, in line order. */
export async function listWaitlist(target?: SeatTarget) {
  const d = requireDb();
  const live = sql`${waitlist.status} in ('waiting', 'offered')`;
  const where = target
    ? and(eq(target.kind === "class" ? waitlist.classId : waitlist.eventId, target.id), live)
    : live;
  return d.select().from(waitlist).where(where).orderBy(waitlist.createdAt);
}

/** Waitlist entries a signed-in student has, so booking pages can show "On waitlist". */
export async function getMyWaitlist(email: string) {
  return requireDb()
    .select({
      id: waitlist.id,
      classId: waitlist.classId,
      eventId: waitlist.eventId,
      status: waitlist.status,
      offerExpiresAt: waitlist.offerExpiresAt,
    })
    .from(waitlist)
    .where(and(eq(waitlist.email, email.trim().toLowerCase()), sql`${waitlist.status} in ('waiting', 'offered')`));
}

/** A booking by someone on the waitlist closes their entry (and releases their held seat into the booking). */
export async function markWaitlistBooked(input: { email: string; classId?: string | null; eventId?: string | null; bookingId: string }) {
  const target = seatTargetOf({ type: input.classId ? "class" : "event", classId: input.classId, eventId: input.eventId });
  if (!target) return;
  await requireDb()
    .update(waitlist)
    .set({ status: "booked", bookingId: input.bookingId })
    .where(
      and(
        eq(target.kind === "class" ? waitlist.classId : waitlist.eventId, target.id),
        eq(waitlist.email, input.email.trim().toLowerCase()),
        sql`${waitlist.status} in ('waiting', 'offered')`
      )
    );
}

/**
 * Hands freed seats to the waitlist: expires offers nobody used, then offers
 * each free seat to the next person waiting. Returns the new offers so the
 * caller can email them. `force` offers one seat to the next person even when
 * the class is still full (admin "notify next").
 */
export async function allocateWaitlistSeats(target?: SeatTarget, opts: { force?: boolean } = {}) {
  const d = requireDb();
  const now = new Date();
  await d
    .update(waitlist)
    .set({ status: "expired" })
    .where(and(eq(waitlist.status, "offered"), lte(waitlist.offerExpiresAt, now)));

  const waiting = await d
    .select()
    .from(waitlist)
    .where(
      target
        ? and(eq(target.kind === "class" ? waitlist.classId : waitlist.eventId, target.id), eq(waitlist.status, "waiting"))
        : eq(waitlist.status, "waiting")
    )
    .orderBy(waitlist.createdAt);
  if (!waiting.length) return [];

  const { map } = await getSeatMap();
  const free = new Map<string, number>();
  const offers: WaitlistRow[] = [];
  const expires = new Date(now.getTime() + WAITLIST_OFFER_HOURS * 3600 * 1000);
  for (const w of waiting) {
    const id = w.classId ?? w.eventId;
    if (!id) continue;
    if (!free.has(id)) {
      const info = map.get(id);
      const left = info ? (Number.isFinite(info.left) ? info.left : 0) : 0;
      free.set(id, opts.force ? Math.max(left, 1) : left);
    }
    if ((free.get(id) ?? 0) <= 0) continue;
    // Still free of a live booking? (they may have booked some other way)
    if (await findActiveDuplicate({ email: w.email, type: w.type, classId: w.classId, eventId: w.eventId })) {
      await d.update(waitlist).set({ status: "booked" }).where(eq(waitlist.id, w.id));
      continue;
    }
    const [row] = await d
      .update(waitlist)
      .set({ status: "offered", offeredAt: now, offerExpiresAt: expires })
      .where(and(eq(waitlist.id, w.id), eq(waitlist.status, "waiting")))
      .returning();
    if (row) {
      offers.push(row);
      free.set(id, (free.get(id) ?? 0) - 1);
    }
  }
  return offers;
}

/** What the waitlist email needs to say about the class / event. */
export async function describeSeatTarget(entry: { classId: string | null; eventId: string | null }) {
  const d = requireDb();
  if (entry.classId) {
    const [c] = await d.select().from(classes).where(eq(classes.id, entry.classId));
    if (!c) return null;
    return {
      title: `${c.name} · ${c.startTime.slice(0, 5)}–${c.endTime.slice(0, 5)}`,
      when: [c.days, c.startDate && c.endDate ? `${c.startDate} – ${c.endDate}` : c.startDate].filter(Boolean).join(" · "),
      location: c.location,
      path: "/book/class",
    };
  }
  if (entry.eventId) {
    const [e] = await d.select().from(events).where(eq(events.id, entry.eventId));
    if (!e) return null;
    return { title: e.title, when: e.date, location: e.location, path: "/book/workshops" };
  }
  return null;
}

/** Capacity overview for the admin page: every active class and every upcoming event. */
export async function getCapacityOverview() {
  const d = requireDb();
  const today = new Date().toISOString().slice(0, 10);
  // Seat map first (it runs its own parallel queries) so we never ask the small
  // connection pool for more than a few connections at once.
  const { map } = await getSeatMap();
  const [classRows, eventRows, queue] = await Promise.all([
    d.select().from(classes).where(eq(classes.active, true)).orderBy(classes.name),
    d.select().from(events).orderBy(events.eventDate),
    listWaitlist(),
  ]);
  const queueFor = (id: string) => queue.filter((w) => w.classId === id || w.eventId === id);
  const items = [
    ...classRows
      .filter((c) => !c.endDate || c.endDate >= today)
      .map((c) => ({
        kind: "class" as const,
        type: "class",
        id: c.id,
        title: c.name,
        subtitle: `${c.days ?? ""} ${c.startTime.slice(0, 5)}–${c.endTime.slice(0, 5)}`.trim(),
        dates: c.startDate && c.endDate ? `${c.startDate} – ${c.endDate}` : c.startDate ?? "",
        location: c.location,
        mode: c.mode,
        category: c.category,
        seats: seatJson(map.get(c.id)),
        waitlist: queueFor(c.id),
      })),
    ...eventRows
      .filter((e) => (e.endDate ?? e.eventDate ?? today) >= today)
      .map((e) => ({
        kind: "event" as const,
        type: e.kind,
        id: e.id,
        title: e.title,
        subtitle: e.date,
        dates: e.eventDate ?? "",
        location: e.location,
        mode: e.mode,
        category: e.kind === "workshop" ? "Workshop" : "Event",
        seats: seatJson(map.get(e.id)),
        waitlist: queueFor(e.id),
      })),
  ];
  return items;
}

// ───────────── Promotions ─────────────

export const PROMO_COOKIE = "af_promo";
export const PROMO_CHANNELS = ["instagram", "facebook", "whatsapp", "email", "flyer", "google", "other"] as const;
export const PROMO_LANDINGS = ["workshops", "class", "studio", "home"] as const;

export type PromotionInput = {
  name: string;
  slug?: string;
  channel?: string;
  eventId?: string | null;
  landing?: string;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
  notes?: string | null;
};

const promoSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function cleanPromotion(input: Partial<PromotionInput>) {
  const out: Partial<typeof promotions.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim().slice(0, 120);
    if (!name) throw new ConflictError("Give the promotion a name.");
    out.name = name;
  }
  if (input.slug !== undefined && String(input.slug).trim()) {
    const slug = slugify(String(input.slug));
    if (!slug) throw new ConflictError("The link name can only use letters, numbers and dashes.");
    out.slug = slug;
  }
  if (input.channel !== undefined) out.channel = (PROMO_CHANNELS as readonly string[]).includes(input.channel) ? input.channel : "other";
  if (input.landing !== undefined) out.landing = (PROMO_LANDINGS as readonly string[]).includes(input.landing) ? input.landing : "workshops";
  if (input.eventId !== undefined) out.eventId = input.eventId || null;
  if (input.startDate !== undefined) out.startDate = input.startDate || null;
  if (input.endDate !== undefined) out.endDate = input.endDate || null;
  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.notes !== undefined) out.notes = String(input.notes ?? "").trim().slice(0, 500) || null;
  if (out.startDate && out.endDate && out.endDate < out.startDate) throw new ConflictError("The end date is before the start date.");
  return out;
}

export async function createPromotion(input: PromotionInput, createdBy: string) {
  const values = cleanPromotion(input);
  const slug = values.slug ?? promoSlug(input.name);
  if (!slug) throw new ConflictError("Give the promotion a name.");
  const [clash] = await requireDb().select({ id: promotions.id }).from(promotions).where(eq(promotions.slug, slug));
  if (clash) throw new ConflictError(`The link /p/${slug} is already used by another promotion — choose another link name.`);
  const [row] = await requireDb()
    .insert(promotions)
    .values({ ...values, name: values.name!, slug, createdBy })
    .returning();
  return row;
}

export async function updatePromotion(id: string, patch: Partial<PromotionInput>) {
  const values = cleanPromotion(patch);
  if (values.slug) {
    const [clash] = await requireDb().select({ id: promotions.id }).from(promotions).where(eq(promotions.slug, values.slug));
    if (clash && clash.id !== id) throw new ConflictError(`The link /p/${values.slug} is already used by another promotion.`);
  }
  const [row] = await requireDb().update(promotions).set(values).where(eq(promotions.id, id)).returning();
  return row ?? null;
}

export async function deletePromotion(id: string) {
  await requireDb().delete(promotions).where(eq(promotions.id, id));
}

/** A promotion link was opened: count it and return where to send them. */
export async function recordPromotionClick(slug: string) {
  const [row] = await requireDb()
    .update(promotions)
    .set({ clicks: sql`${promotions.clicks} + 1` })
    .where(eq(promotions.slug, promoSlug(slug)))
    .returning();
  return row ?? null;
}

/** The promotion id in a visitor's cookie, if it still exists and is live. */
export async function validPromotionId(id: string | null | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await requireDb().select({ id: promotions.id, active: promotions.active }).from(promotions).where(eq(promotions.id, id));
  return row?.active ? row.id : null;
}

/** Every promotion with its results: clicks, enquiries, bookings, paid revenue. */
export async function listPromotionsWithStats() {
  const d = requireDb();
  const [rows, enq, regs, evs] = await Promise.all([
    d.select().from(promotions).orderBy(desc(promotions.createdAt)),
    d
      .select({
        promotionId: enquiries.promotionId,
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${enquiries.status} = 'new')::int`,
      })
      .from(enquiries)
      .where(sql`${enquiries.promotionId} is not null`)
      .groupBy(enquiries.promotionId),
    d
      .select({
        promotionId: registrations.promotionId,
        bookings: sql<number>`count(*) filter (where ${registrations.paid} = 'paid')::int`,
        revenue: sql<number>`coalesce(sum(${registrations.amount}) filter (where ${registrations.paid} = 'paid'), 0)::int`,
      })
      .from(registrations)
      .where(sql`${registrations.promotionId} is not null`)
      .groupBy(registrations.promotionId),
    d.select({ id: events.id, title: events.title, kind: events.kind }).from(events),
  ]);
  const e = new Map(enq.map((x) => [x.promotionId, x]));
  const r = new Map(regs.map((x) => [x.promotionId, x]));
  const ev = new Map(evs.map((x) => [x.id, x]));
  return rows.map((p) => ({
    ...p,
    event: p.eventId ? ev.get(p.eventId) ?? null : null,
    enquiries: e.get(p.id)?.total ?? 0,
    openEnquiries: e.get(p.id)?.open ?? 0,
    bookings: r.get(p.id)?.bookings ?? 0,
    revenue: r.get(p.id)?.revenue ?? 0,
  }));
}

/** One promotion's enquiries and bookings, for follow-up. */
export async function getPromotionActivity(id: string) {
  const d = requireDb();
  const [enq, regs] = await Promise.all([
    d.select().from(enquiries).where(eq(enquiries.promotionId, id)).orderBy(desc(enquiries.createdAt)),
    d
      .select({
        id: registrations.id,
        name: registrations.name,
        email: registrations.email,
        type: registrations.type,
        detail: registrations.detail,
        amount: registrations.amount,
        paid: registrations.paid,
        status: registrations.status,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(eq(registrations.promotionId, id))
      .orderBy(desc(registrations.createdAt)),
  ]);
  return { enquiries: enq, bookings: regs };
}

// ───────────── Bulk messages ─────────────

export type BulkAudience = {
  /** Booking types they have (any of). Empty = don't filter. */
  bookingTypes?: string[];
  classIds?: string[];
  eventIds?: string[];
  /** Studio locations (booking location or home studio). Empty = all. */
  locations?: string[];
  /** Customer status (default: active only). */
  statuses?: string[];
  /** Only people with a booking that's still running / upcoming. */
  currentOnly?: boolean;
};

export type BulkRecipient = { name: string; email: string; phone: string | null; location: string | null };

/** Everyone a bulk message would go to. Blacklisted customers are never included. */
export async function resolveBulkAudience(a: BulkAudience): Promise<BulkRecipient[]> {
  const d = requireDb();
  const statuses = a.statuses?.length ? a.statuses : ["active"];
  const people = await d
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      location: users.location,
      customerStatus: users.customerStatus,
      blacklisted: users.blacklisted,
    })
    .from(users)
    .where(eq(users.role, "student"));
  const eligible = people.filter((p) => !p.blacklisted && statuses.includes(p.customerStatus));

  const bookingFilter = Boolean(a.bookingTypes?.length || a.classIds?.length || a.eventIds?.length || a.currentOnly);
  const locFilter = new Set(a.locations ?? []);
  if (!bookingFilter && !locFilter.size) return eligible.map(({ name, email, phone, location }) => ({ name, email, phone, location }));

  const holdSince = new Date(Date.now() - PAYMENT_HOLD_MS);
  const regs = await d
    .select({
      email: registrations.email,
      type: registrations.type,
      classId: registrations.classId,
      eventId: registrations.eventId,
      location: registrations.location,
      period: registrations.period,
    })
    .from(registrations)
    .where(
      and(
        sql`${registrations.status} <> ${PAYMENT_CANCELLED_STATUS}`,
        or(sql`${registrations.paid} <> 'pending'`, isNull(registrations.paymentMethod), gt(registrations.createdAt, holdSince))
      )
    );
  const [eventDates] = await Promise.all([
    a.currentOnly ? d.select({ id: events.id, end: events.endDate, start: events.eventDate }).from(events) : Promise.resolve([]),
  ]);
  const eventEnd = new Map(eventDates.map((e) => [e.id, e.end ?? e.start]));
  const today = new Date().toISOString().slice(0, 10);
  const types = new Set(a.bookingTypes ?? []);
  const classIds = new Set(a.classIds ?? []);
  const eventIds = new Set(a.eventIds ?? []);

  const matchReg = (r: (typeof regs)[number]) => {
    if (types.size && !types.has(r.type)) return false;
    // Specific classes / events picked: the booking must be one of them.
    if ((classIds.size || eventIds.size) && !((r.classId && classIds.has(r.classId)) || (r.eventId && eventIds.has(r.eventId)))) return false;
    if (locFilter.size && !locFilter.has(r.location)) return false;
    if (a.currentOnly) {
      const end = r.eventId ? eventEnd.get(r.eventId) ?? null : periodEnd(r.period);
      if (end && end < today) return false;
    }
    return true;
  };
  const matched = new Set(regs.filter(matchReg).map((r) => r.email));
  return eligible
    .filter((p) => matched.has(p.email) || (!bookingFilter && locFilter.size > 0 && p.location != null && locFilter.has(p.location)))
    .map(({ name, email, phone, location }) => ({ name, email, phone, location }));
}

export async function createBulkMessage(input: {
  subject: string;
  message: string;
  audience: BulkAudience;
  audienceLabel: string;
  recipientCount: number;
  createdBy: string;
}) {
  const [row] = await requireDb()
    .insert(bulkMessages)
    .values({
      subject: input.subject,
      message: input.message,
      audience: JSON.stringify(input.audience),
      audienceLabel: input.audienceLabel,
      recipientCount: input.recipientCount,
      createdBy: input.createdBy,
    })
    .returning();
  return row;
}

export async function finishBulkMessage(
  id: string,
  result: { sent: number; failed: number; status: string; error?: string | null; announcementId?: string | null }
) {
  await requireDb()
    .update(bulkMessages)
    .set({
      sentCount: result.sent,
      failedCount: result.failed,
      status: result.status,
      error: result.error ?? null,
      announcementId: result.announcementId ?? null,
      finishedAt: new Date(),
    })
    .where(eq(bulkMessages.id, id));
}

export async function listBulkMessages(limit = 50) {
  return requireDb().select().from(bulkMessages).orderBy(desc(bulkMessages.createdAt)).limit(limit);
}

// ───────────── Studio holidays / closures ─────────────

export type StudioHoliday = {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (same as start for one day)
  location: string | null; // null = every studio
};

const HOLIDAYS_KEY = "studio_holidays";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function listHolidays(): Promise<StudioHoliday[]> {
  const [row] = await requireDb().select().from(appSettings).where(eq(appSettings.key, HOLIDAYS_KEY));
  if (!row) return [];
  try {
    const list = JSON.parse(row.value) as StudioHoliday[];
    return Array.isArray(list) ? list.sort((a, b) => a.startDate.localeCompare(b.startDate)) : [];
  } catch {
    return [];
  }
}

/** Replaces the whole list (validated). */
export async function saveHolidays(input: unknown): Promise<StudioHoliday[]> {
  if (!Array.isArray(input)) throw new ConflictError("Send a list of holidays.");
  const list: StudioHoliday[] = input.map((h, i) => {
    const title = String(h?.title ?? "").trim().slice(0, 120);
    const startDate = String(h?.startDate ?? "");
    const endDate = String(h?.endDate || startDate);
    if (!title) throw new ConflictError(`Holiday ${i + 1}: give it a name.`);
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) throw new ConflictError(`"${title}": choose valid dates.`);
    if (endDate < startDate) throw new ConflictError(`"${title}": the end date is before the start date.`);
    return {
      id: String(h?.id || crypto.randomUUID()),
      title,
      startDate,
      endDate,
      location: String(h?.location ?? "").trim() || null,
    };
  });
  const value = JSON.stringify(list);
  await requireDb()
    .insert(appSettings)
    .values({ key: HOLIDAYS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  return listHolidays();
}

// ───────────── Invoices ─────────────

/** Business details printed on every invoice (Admin → VAT Master → Invoice details). */
export type InvoiceSeller = {
  businessName: string;
  orgNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  footerNote: string;
};

const INVOICE_SELLER_KEY = "invoice_seller";

export const DEFAULT_INVOICE_SELLER: InvoiceSeller = {
  businessName: "Anchor Dance & Fitness",
  orgNumber: "",
  vatNumber: "",
  address: "Helenelund, Stockholm, Sweden",
  email: "",
  phone: "",
  website: "",
  footerNote: "Thank you for dancing with us!",
};

export async function getInvoiceSeller(): Promise<InvoiceSeller> {
  const [row] = await requireDb().select().from(appSettings).where(eq(appSettings.key, INVOICE_SELLER_KEY));
  if (!row) return DEFAULT_INVOICE_SELLER;
  try {
    return { ...DEFAULT_INVOICE_SELLER, ...(JSON.parse(row.value) as Partial<InvoiceSeller>) };
  } catch {
    return DEFAULT_INVOICE_SELLER;
  }
}

export async function saveInvoiceSeller(patch: Partial<InvoiceSeller>) {
  const current = await getInvoiceSeller();
  const next: InvoiceSeller = { ...current };
  for (const k of Object.keys(DEFAULT_INVOICE_SELLER) as (keyof InvoiceSeller)[]) {
    if (patch[k] !== undefined) next[k] = String(patch[k] ?? "").trim().slice(0, 300);
  }
  if (!next.businessName) next.businessName = DEFAULT_INVOICE_SELLER.businessName;
  const value = JSON.stringify(next);
  await requireDb()
    .insert(appSettings)
    .values({ key: INVOICE_SELLER_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  return next;
}

export async function getInvoiceByRegistration(registrationId: string) {
  const [row] = await requireDb().select().from(invoices).where(eq(invoices.registrationId, registrationId));
  return row ?? null;
}

/**
 * The invoice for a paid booking — issued (numbered and frozen) the first time
 * it's asked for. Returns null for a booking that isn't paid (or was free /
 * waived: nothing was charged, so there's nothing to invoice).
 */
export async function ensureInvoice(registrationId: string) {
  const existing = await getInvoiceByRegistration(registrationId);
  if (existing) return existing;
  const r = await getRegistrationById(registrationId);
  if (!r || r.paid !== "paid" || r.amount <= 0) return null;

  const seller = await getInvoiceSeller();
  const vat = r.vatMode ? r.vatAmount : 0;
  const net = r.netAmount ?? r.amount - vat;
  // List price as advertised: incl. VAT when VAT is inclusive, before VAT when exclusive.
  const discount = r.discountAmount ?? 0;
  const base = r.baseAmount ?? (r.vatMode === "exclusive" ? net : r.amount) + discount;
  const description =
    r.type === "studio" ? `Studio hire · ${(r.detail ?? "").split(" · ").slice(0, 2).join(" · ")}` : r.detail || r.plan || "Booking";
  const details = [r.type === "class" ? r.plan : null, r.type !== "studio" ? r.period : null, r.location, r.mode === "online" ? "Online" : r.mode === "offline" ? "In-Person" : null]
    .filter(Boolean)
    .join(" · ");

  const d = requireDb();
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ max }] = await d
      .select({ max: sql<number>`coalesce(max(substring(${invoices.number} from '[0-9]+$')::int), 0)::int` })
      .from(invoices)
      .where(like(invoices.number, `INV-${year}-%`));
    const number = `INV-${year}-${String(max + 1).padStart(4, "0")}`;
    const [row] = await d
      .insert(invoices)
      .values({
        number,
        registrationId: r.id,
        customerName: r.name,
        customerEmail: r.email,
        description,
        details,
        bookingType: r.type,
        baseAmount: base,
        discountCode: r.discountCode,
        discountAmount: discount,
        netAmount: net,
        vatRateBp: r.vatMode ? r.vatRateBp : 0,
        vatMode: r.vatMode,
        vatAmount: vat,
        total: r.amount,
        paymentMethod: r.paymentMethod,
        paymentRef: r.paymentRef && r.paymentRef !== "free" ? r.paymentRef : null,
        seller: JSON.stringify(seller),
      })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    // Someone else issued it (same booking) or took the number — look again.
    const again = await getInvoiceByRegistration(registrationId);
    if (again) return again;
  }
  throw new Error(`Couldn't issue an invoice number for ${registrationId}`);
}

export async function markInvoiceEmailed(id: string) {
  await requireDb().update(invoices).set({ emailedAt: new Date() }).where(eq(invoices.id, id));
}

/** Invoice numbers by booking id, for admin lists. */
export async function listInvoiceNumbers() {
  const rows = await requireDb()
    .select({ registrationId: invoices.registrationId, number: invoices.number, emailedAt: invoices.emailedAt })
    .from(invoices);
  return rows;
}

// ───────────── GDPR consent ─────────────

export type ConsentStatus = {
  email: string;
  /** Every required permission is given, against the current wording. */
  consented: boolean;
  /** They agreed to an older wording and should be asked again. */
  needsRenewal: boolean;
  givenAt: Date | null;
  version: string | null;
  /** Each permission on its own — data, photo, video, promo. */
  choices: ConsentChoices;
  /** Any media permission is on (kept for older code and quick filters). */
  mediaConsent: boolean;
  mediaWithdrawnAt: Date | null;
};

/** The user columns for a set of choices. mediaConsent = photos or videos. */
function consentColumns(choices: ConsentChoices, version: string, now = new Date()) {
  const media = choices.photo || choices.video;
  return {
    dataConsent: choices.data,
    photoConsent: choices.photo,
    videoConsent: choices.video,
    promoConsent: choices.promo,
    mediaConsent: media,
    gdprConsentAt: now,
    gdprConsentVersion: version,
    // Only a full media withdrawal is dated; allowing any media clears it.
    mediaConsentWithdrawnAt: media ? null : now,
    updatedAt: now,
  };
}

export async function getConsentStatus(email: string, currentVersion: string): Promise<ConsentStatus | null> {
  const [row] = await requireDb()
    .select({
      email: users.email,
      mediaConsent: users.mediaConsent,
      dataConsent: users.dataConsent,
      photoConsent: users.photoConsent,
      videoConsent: users.videoConsent,
      promoConsent: users.promoConsent,
      givenAt: users.gdprConsentAt,
      version: users.gdprConsentVersion,
      withdrawnAt: users.mediaConsentWithdrawnAt,
    })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!row) return null;
  const choices: ConsentChoices = {
    data: row.dataConsent,
    photo: row.photoConsent,
    video: row.videoConsent,
    promo: row.promoConsent,
  };
  const current = Boolean(row.givenAt) && row.version === currentVersion;
  return {
    email: row.email,
    consented: current && hasRequiredConsent(choices),
    needsRenewal: Boolean(row.givenAt) && row.version !== currentVersion,
    givenAt: row.givenAt,
    version: row.version,
    choices,
    mediaConsent: row.mediaConsent,
    mediaWithdrawnAt: row.withdrawnAt,
  };
}

/**
 * Stores the permissions this person ticked (no row = nothing to record yet).
 * Every call replaces the whole set, so a permission left unticked in My Portal
 * is withdrawn.
 */
export async function recordConsent(email: string, version: string, choices: ConsentChoices) {
  const [row] = await requireDb()
    .update(users)
    .set(consentColumns(choices, version))
    .where(eq(users.email, email.trim().toLowerCase()))
    .returning({ id: users.id });
  return Boolean(row);
}

// ───────────── Zoom links for students ─────────────

/**
 * Zoom links for the online classes a student currently holds (booked, not
 * cancelled, not an abandoned checkout, term not over). Only these students
 * ever see a class's link.
 */
export async function getMyZoomLinks(email: string) {
  const d = requireDb();
  const { classIds } = await getActiveBookedIds(email);
  if (!classIds.length) return [];
  const rows = await d
    .select({
      id: classes.id,
      name: classes.name,
      days: classes.days,
      startDate: classes.startDate,
      endDate: classes.endDate,
      startTime: classes.startTime,
      endTime: classes.endTime,
      coach: classes.coach,
      mode: classes.mode,
      joinUrl: classes.zoomJoinUrl,
      password: classes.zoomPassword,
    })
    .from(classes)
    .where(inArray(classes.id, classIds));
  return rows.filter((r) => r.mode === "online");
}

/** The Zoom link for one booking's class, if it's an online class that has one. */
export async function getZoomLinkForClass(classId: string | null | undefined) {
  if (!classId) return null;
  const [c] = await requireDb()
    .select({ mode: classes.mode, joinUrl: classes.zoomJoinUrl, password: classes.zoomPassword })
    .from(classes)
    .where(eq(classes.id, classId));
  return c && c.mode === "online" && c.joinUrl ? { joinUrl: c.joinUrl, password: c.password } : null;
}

// ───────────── Payment reminders ─────────────

export type ReminderChannel = "sms" | "email" | "whatsapp";

export type ReminderSettings = {
  /** Send due reminders automatically. */
  enabled: boolean;
  /** Days after booking before the first reminder. */
  firstAfterDays: number;
  /** Days between reminders. */
  everyDays: number;
  /** Channel for reminder 1, 2 and 3 (escalation order). */
  channels: [ReminderChannel, ReminderChannel, ReminderChannel];
};

export const MAX_REMINDERS = 3;
const REMINDER_SETTINGS_KEY = "payment_reminders";
// Off until an admin switches it on in Payment Reminders — existing unpaid
// bookings would otherwise all get emailed the moment this goes live.
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  firstAfterDays: 1,
  everyDays: 3,
  channels: ["sms", "email", "whatsapp"],
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const [row] = await requireDb().select().from(appSettings).where(eq(appSettings.key, REMINDER_SETTINGS_KEY));
  if (!row) return DEFAULT_REMINDER_SETTINGS;
  try {
    return { ...DEFAULT_REMINDER_SETTINGS, ...(JSON.parse(row.value) as Partial<ReminderSettings>) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(patch: Partial<ReminderSettings>) {
  const cur = await getReminderSettings();
  const ch = (v: unknown): ReminderChannel => (v === "sms" || v === "whatsapp" ? v : "email");
  const next: ReminderSettings = {
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : cur.enabled,
    firstAfterDays: patch.firstAfterDays !== undefined ? Math.min(60, Math.max(0, Math.round(Number(patch.firstAfterDays) || 0))) : cur.firstAfterDays,
    everyDays: patch.everyDays !== undefined ? Math.min(60, Math.max(1, Math.round(Number(patch.everyDays) || 1))) : cur.everyDays,
    channels: Array.isArray(patch.channels) && patch.channels.length === 3 ? [ch(patch.channels[0]), ch(patch.channels[1]), ch(patch.channels[2])] : cur.channels,
  };
  const value = JSON.stringify(next);
  await requireDb()
    .insert(appSettings)
    .values({ key: REMINDER_SETTINGS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  return next;
}

/**
 * Every unpaid booking with its reminder progress: how many have gone out,
 * when the next is due and on which channel, and whether it's escalated
 * (all reminders sent, still unpaid — time for a person to follow up).
 */
export async function listUnpaidWithReminders() {
  const d = requireDb();
  const settings = await getReminderSettings();
  const [rows, sent, people] = await Promise.all([
    d
      .select({
        id: registrations.id,
        name: registrations.name,
        email: registrations.email,
        type: registrations.type,
        detail: registrations.detail,
        period: registrations.period,
        plan: registrations.plan,
        location: registrations.location,
        amount: registrations.amount,
        paid: registrations.paid,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(UNPAID_SQL)
      .orderBy(registrations.createdAt),
    d.select().from(paymentReminders).orderBy(paymentReminders.createdAt),
    d.select({ email: users.email, phone: users.phone, blacklisted: users.blacklisted, id: users.id }).from(users).where(eq(users.role, "student")),
  ]);
  const byEmail = new Map(people.map((p) => [p.email, p]));
  const now = Date.now();
  const DAY = 86_400_000;
  return rows.map((r) => {
    const history = sent.filter((s) => s.registrationId === r.id);
    const done = history.filter((s) => s.status === "sent" || s.status === "logged");
    const count = Math.min(done.length, MAX_REMINDERS);
    const last = done[done.length - 1]?.createdAt ?? null;
    const created = r.createdAt?.getTime() ?? now;
    const nextDue = count >= MAX_REMINDERS ? null : new Date(count === 0 ? created + settings.firstAfterDays * DAY : (last?.getTime() ?? created) + settings.everyDays * DAY);
    const p = byEmail.get(r.email);
    return {
      ...r,
      phone: p?.phone ?? null,
      customerId: p?.id ?? null,
      blacklisted: p?.blacklisted ?? false,
      daysUnpaid: Math.max(0, Math.floor((now - created) / DAY)),
      remindersSent: count,
      lastReminderAt: last,
      nextStep: count >= MAX_REMINDERS ? null : count + 1,
      nextChannel: count >= MAX_REMINDERS ? null : settings.channels[count],
      nextDueAt: nextDue,
      due: Boolean(nextDue && nextDue.getTime() <= now),
      escalated: count >= MAX_REMINDERS,
      history: history.map((h) => ({ step: h.step, channel: h.channel, sentVia: h.sentVia, status: h.status, error: h.error, sentBy: h.sentBy, at: h.createdAt })),
    };
  });
}

export async function recordPaymentReminder(entry: {
  registrationId: string;
  step: number;
  channel: ReminderChannel;
  sentVia: string | null;
  status: "sent" | "logged" | "failed" | "skipped";
  error?: string | null;
  sentBy?: string | null;
}) {
  const [row] = await requireDb()
    .insert(paymentReminders)
    .values({ ...entry, error: entry.error ?? null, sentBy: entry.sentBy ?? null })
    .returning();
  return row;
}

export async function listReminderHistory(limit = 50) {
  const d = requireDb();
  const rows = await d.select().from(paymentReminders).orderBy(desc(paymentReminders.createdAt)).limit(limit);
  const ids = Array.from(new Set(rows.map((r) => r.registrationId)));
  const regs = ids.length
    ? await d.select({ id: registrations.id, name: registrations.name, email: registrations.email, amount: registrations.amount }).from(registrations).where(inArray(registrations.id, ids))
    : [];
  const byId = new Map(regs.map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, booking: byId.get(r.registrationId) ?? null }));
}

// ───────────── Revenue dashboard ─────────────

export type RevenueSlice = { key: string; label: string; revenue: number; net: number; vat: number; discount: number; bookings: number };

/**
 * Paid revenue by month (last 12 months) split by booking type, and the chosen
 * month broken down by class / batch, category, location and type. Revenue is
 * what customers paid (incl. VAT); net and VAT are shown separately. A
 * booking counts in the month it was made.
 */
export async function getRevenueReport(opts: { month?: string; location?: string } = {}) {
  const d = requireDb();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(opts.month ?? "") ? opts.month! : thisMonth;
  const [y, m] = month.split("-").map(Number);
  // 12 months ending with the selected month.
  const months = Array.from({ length: 12 }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 12 + i, 1));
    return dt.toISOString().slice(0, 7);
  });
  const from = new Date(`${months[0]}-01T00:00:00Z`);

  const [rows, classRows] = await Promise.all([
    d
      .select({
        id: registrations.id,
        type: registrations.type,
        amount: registrations.amount,
        net: registrations.netAmount,
        vat: registrations.vatAmount,
        vatMode: registrations.vatMode,
        discount: registrations.discountAmount,
        location: registrations.location,
        category: registrations.category,
        classId: registrations.classId,
        detail: registrations.detail,
        paymentMethod: registrations.paymentMethod,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(and(eq(registrations.paid, "paid"), gt(registrations.amount, 0), sql`${registrations.createdAt} >= ${from.toISOString()}`)),
    d.select({ id: classes.id, name: classes.name, startTime: classes.startTime, endTime: classes.endTime }).from(classes),
  ]);
  const classById = new Map(classRows.map((c) => [c.id, c]));
  const filtered = rows.filter((r) => !opts.location || r.location === opts.location);
  const monthOf = (r: (typeof rows)[number]) => (r.createdAt ? r.createdAt.toISOString().slice(0, 7) : "");
  const netOf = (r: (typeof rows)[number]) => (r.vatMode ? r.net ?? r.amount - r.vat : r.amount);

  const TYPES = ["class", "workshop", "event", "studio"] as const;
  const trend = months.map((mo) => {
    const inMonth = filtered.filter((r) => monthOf(r) === mo);
    const byType = Object.fromEntries(TYPES.map((t) => [t, inMonth.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0)])) as Record<
      (typeof TYPES)[number],
      number
    >;
    return {
      month: mo,
      total: inMonth.reduce((s, r) => s + r.amount, 0),
      net: inMonth.reduce((s, r) => s + netOf(r), 0),
      vat: inMonth.reduce((s, r) => s + (r.vatMode ? r.vat : 0), 0),
      bookings: inMonth.length,
      byType,
    };
  });

  const selected = filtered.filter((r) => monthOf(r) === month);
  const group = (keyOf: (r: (typeof rows)[number]) => [string, string]): RevenueSlice[] => {
    const map = new Map<string, RevenueSlice>();
    for (const r of selected) {
      const [key, label] = keyOf(r);
      const e = map.get(key) ?? { key, label, revenue: 0, net: 0, vat: 0, discount: 0, bookings: 0 };
      e.revenue += r.amount;
      e.net += netOf(r);
      e.vat += r.vatMode ? r.vat : 0;
      e.discount += r.discount ?? 0;
      e.bookings += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  };
  const TYPE_LABEL: Record<string, string> = { class: "Classes", workshop: "Workshops", event: "Events", studio: "Studio hire" };

  const prevMonth = trend[trend.length - 2];
  const current = trend[trend.length - 1];
  const yearStart = `${month.slice(0, 4)}-01`;
  return {
    month,
    months,
    trend,
    kpis: {
      revenue: current.total,
      net: current.net,
      vat: current.vat,
      bookings: current.bookings,
      average: current.bookings ? Math.round(current.total / current.bookings) : 0,
      previous: prevMonth?.total ?? 0,
      discount: selected.reduce((s, r) => s + (r.discount ?? 0), 0),
      yearToDate: trend.filter((t) => t.month >= yearStart).reduce((s, t) => s + t.total, 0),
    },
    byType: group((r) => [r.type, TYPE_LABEL[r.type] ?? r.type]),
    byClass: group((r) => {
      if (r.type === "class") {
        const c = r.classId ? classById.get(r.classId) : null;
        if (c) return [`class:${c.id}`, `${c.name} · ${c.startTime.slice(0, 5)}–${c.endTime.slice(0, 5)}`];
        const name = (r.detail ?? "").trim();
        return [`class-detail:${name}`, /\bPlan$/.test(name) ? `${name} (plan only)` : name || "Class (no batch yet)"];
      }
      if (r.type === "studio") return ["studio", "Studio hire"];
      return [`${r.type}:${r.detail ?? ""}`, `${r.type === "workshop" ? "🎭" : "⭐"} ${r.detail ?? r.type}`];
    }),
    byCategory: group((r) => {
      const c = r.type === "class" ? r.category || "Uncategorised" : TYPE_LABEL[r.type];
      return [c, c];
    }),
    byLocation: group((r) => [r.location, r.location]),
    byMethod: group((r) => {
      const m = r.paymentMethod ?? "external";
      return [m, m === "stripe" ? "Card (Stripe)" : m === "swish" ? "Swish" : m === "external" ? "Paid at the studio" : m];
    }),
  };
}

// ───────────── Coupon usage ─────────────

/**
 * Every use of a discount code: who, when, what for, the discount it gave and
 * the revenue that came in. Bookings made before the discount was recorded on
 * the booking get an estimate from the code's current rule (marked estimated).
 */
export async function getCouponReport(opts: { from?: string; to?: string } = {}) {
  const d = requireDb();
  const [codes, uses] = await Promise.all([
    d.select().from(discounts),
    d
      .select({
        id: registrations.id,
        name: registrations.name,
        email: registrations.email,
        type: registrations.type,
        detail: registrations.detail,
        location: registrations.location,
        code: registrations.discountCode,
        amount: registrations.amount,
        net: registrations.netAmount,
        vatMode: registrations.vatMode,
        vat: registrations.vatAmount,
        base: registrations.baseAmount,
        discount: registrations.discountAmount,
        paid: registrations.paid,
        status: registrations.status,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(sql`${registrations.discountCode} is not null and ${registrations.discountCode} <> ''`)
      .orderBy(desc(registrations.createdAt)),
  ]);
  const byCode = new Map(codes.map((c) => [c.code.toUpperCase(), c]));
  const inRange = (dt: Date | null) => {
    const day = dt ? dt.toISOString().slice(0, 10) : "";
    return (!opts.from || day >= opts.from) && (!opts.to || day <= opts.to);
  };

  const rows = uses
    .filter((u) => inRange(u.createdAt) && u.status !== PAYMENT_CANCELLED_STATUS)
    .map((u) => {
      const rule = byCode.get((u.code ?? "").toUpperCase());
      // Price after discount in list-price terms (what the discount was taken from).
      const after = u.vatMode === "exclusive" ? u.net ?? u.amount - u.vat : u.amount;
      let discount = u.discount;
      let estimated = false;
      if (discount == null) {
        estimated = true;
        if (rule?.type === "flat") discount = rule.flatAmount ?? 0;
        else if (rule?.percent && rule.percent < 100) discount = Math.round(after / (1 - rule.percent / 100)) - after;
        else discount = 0;
      }
      return {
        ...u,
        code: (u.code ?? "").toUpperCase(),
        discount,
        before: u.base ?? after + discount,
        estimated,
        counted: u.paid === "paid" || u.paid === "onetime",
      };
    });

  const summary = new Map<
    string,
    { code: string; name: string | null; rule: string; active: boolean | null; validUntil: string | null; uses: number; paidUses: number; customers: Set<string>; before: number; discount: number; revenue: number; estimated: boolean; lastUsed: Date | null }
  >();
  for (const c of codes) {
    summary.set(c.code.toUpperCase(), {
      code: c.code.toUpperCase(),
      name: c.name,
      rule: c.type === "flat" ? `SEK ${c.flatAmount ?? 0} off` : `${c.percent ?? 0}% off`,
      active: c.active,
      validUntil: c.validUntil,
      uses: 0,
      paidUses: 0,
      customers: new Set(),
      before: 0,
      discount: 0,
      revenue: 0,
      estimated: false,
      lastUsed: null,
    });
  }
  for (const r of rows) {
    const s =
      summary.get(r.code) ??
      summary
        .set(r.code, { code: r.code, name: null, rule: "Code deleted", active: null, validUntil: null, uses: 0, paidUses: 0, customers: new Set(), before: 0, discount: 0, revenue: 0, estimated: false, lastUsed: null })
        .get(r.code)!;
    s.uses++;
    s.customers.add(r.email);
    if (!s.lastUsed || (r.createdAt && r.createdAt > s.lastUsed)) s.lastUsed = r.createdAt;
    if (r.counted) {
      s.paidUses++;
      s.before += r.before;
      s.discount += r.discount;
      s.revenue += r.paid === "paid" ? r.amount : 0;
      if (r.estimated) s.estimated = true;
    }
  }

  return {
    codes: Array.from(summary.values())
      .map((s) => ({ ...s, customers: s.customers.size }))
      .sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code)),
    uses: rows,
  };
}

// ───────────── Trial sessions ─────────────

/**
 * Who has had a trial, when, and whether it turned into a paid enrolment.
 *  - A trial is a booking on a Demo/trial plan (plans with interval "demo",
 *    or a plan named "demo"/"trial").
 *  - Converted = the same person later paid for a class on a regular plan.
 *  - Requests = "Book a Demo" enquiries from people who haven't booked a trial yet.
 */
export async function getTrialReport() {
  const d = requireDb();
  const [planRows, regs, enquiryRows] = await Promise.all([
    d.select({ name: plans.name, interval: plans.interval }).from(plans),
    d.select().from(registrations).orderBy(registrations.createdAt),
    d.select().from(enquiries).orderBy(desc(enquiries.createdAt)),
  ]);
  const demoPlans = new Set(planRows.filter((p) => p.interval === "demo").map((p) => p.name.toLowerCase()));
  const isTrial = (plan: string | null) => {
    const p = (plan ?? "").toLowerCase();
    return demoPlans.has(p) || /\b(demo|trial)\b/.test(p);
  };
  const today = new Date().toISOString().slice(0, 10);
  const trialRows = regs.filter((r) => r.type === "class" && isTrial(r.plan));

  const trials = trialRows.map((t) => {
    const convertedBy = regs.find(
      (r) =>
        r.email === t.email &&
        r.id !== t.id &&
        r.type === "class" &&
        !isTrial(r.plan) &&
        r.paid === "paid" &&
        r.status !== PAYMENT_CANCELLED_STATUS &&
        (r.createdAt ?? 0) >= (t.createdAt ?? 0)
    );
    const start = (t.period ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
    const cancelled = t.status === PAYMENT_CANCELLED_STATUS;
    const trialDate = start ?? (t.createdAt ? t.createdAt.toISOString().slice(0, 10) : null);
    const stage = cancelled
      ? "cancelled"
      : convertedBy
      ? "converted"
      : trialDate && trialDate > today
      ? "upcoming"
      : "follow_up";
    const days =
      convertedBy?.createdAt && t.createdAt
        ? Math.max(0, Math.round((convertedBy.createdAt.getTime() - t.createdAt.getTime()) / 86_400_000))
        : null;
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      location: t.location,
      category: t.category,
      level: t.level,
      detail: t.detail,
      mode: t.mode,
      trialDate,
      bookedAt: t.createdAt,
      paid: t.paid,
      stage: stage as "cancelled" | "converted" | "upcoming" | "follow_up",
      convertedBooking: convertedBy
        ? { id: convertedBy.id, plan: convertedBy.plan, amount: convertedBy.amount, at: convertedBy.createdAt, detail: convertedBy.detail }
        : null,
      daysToConvert: days,
    };
  });

  const trialEmails = new Set(trialRows.map((t) => t.email.toLowerCase()));
  const bookedEmails = new Set(regs.map((r) => r.email.toLowerCase()));
  const requests = enquiryRows
    .filter((e) => e.kind !== "workshop" && !trialEmails.has(e.email.trim().toLowerCase()) && e.status !== "closed")
    .map((e) => ({
      id: e.id,
      name: e.fullName,
      email: e.email,
      phone: `${e.phoneCountryCode ?? ""} ${e.phone}`.trim(),
      interest: e.areaOfInterest,
      typeOfClass: e.typeOfClass,
      location: e.preferredLocation,
      status: e.status,
      createdAt: e.createdAt,
      alreadyBooked: bookedEmails.has(e.email.trim().toLowerCase()),
    }));

  return { trials: trials.reverse(), requests };
}

/** How often each pause / drop-off reason was chosen — for spotting patterns. */
export async function getDropReasonStats() {
  return requireDb()
    .select({
      reasonCode: customerStatusLog.reasonCode,
      action: customerStatusLog.action,
      count: sql<number>`count(*)::int`,
    })
    .from(customerStatusLog)
    .where(sql`${customerStatusLog.action} in ('paused', 'dropped') and ${customerStatusLog.reasonCode} is not null`)
    .groupBy(customerStatusLog.reasonCode, customerStatusLog.action);
}
