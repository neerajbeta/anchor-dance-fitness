import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  date,
  time,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ───────────────────────── Enums ─────────────────────────
export const bookingTypeEnum = pgEnum("booking_type", ["class", "workshop", "event", "studio"]);
export const modeEnum = pgEnum("mode", ["online", "offline"]);
export const paymentStatusEnum = pgEnum("payment_status", ["paid", "overdue", "pending", "onetime"]);
export const roleEnum = pgEnum("role", ["student", "admin", "coach"]);
export const paymentMethodEnum = pgEnum("payment_method", ["swish", "stripe", "external", "waived"]);
export const paymentStateEnum = pgEnum("payment_state", ["pending", "succeeded", "failed", "refunded"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "cancelled", "waitlisted"]);
export const planIntervalEnum = pgEnum("plan_interval", ["demo", "monthly", "quarterly", "biannual", "annual", "onetime"]);
export const relationshipEnum = pgEnum("relationship", ["child", "spouse", "sibling", "other"]);
export const discountScopeEnum = pgEnum("discount_scope", [
  "all",
  "category",
  "class",
  "event",
  "workshop",
  "studio",
]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "flat"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);

// ───────────────────────── Roles & Permissions (admin RBAC) ─────────────────────────
// A "role" here governs what an admin-panel account (role='admin'/'coach' on `users`) can
// see/do once logged in — separate from the coarse users.role enum, which only gates whether
// an account can reach the admin login at all. Super Admin / Admin / Manager / Staff are rows
// here, not enum values, so new roles can be added without a schema change.
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // e.g. "super-admin"
  description: text("description"),
  status: userStatusEnum("status").notNull().default("active"),
  isSystemRole: boolean("is_system_role").notNull().default(false), // protected: can't edit/delete
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// The full permission catalog — one row per "module.action" (e.g. "users.create"). New modules
// are onboarded by inserting rows here; no schema change needed.
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // display label, e.g. "Create Users"
  slug: text("slug").notNull().unique(), // "users.create"
  module: text("module").notNull(), // "users"
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Users (§13, §15) ─────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // bcrypt; null for OAuth-only
  role: roleEnum("role").notNull().default("student"), // coarse: student vs admin-panel account
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "set null" }), // fine-grained permissions (admin-panel accounts only)
  status: userStatusEnum("status").notNull().default("active"),
  phone: text("phone"),
  dob: date("dob"),
  gender: text("gender"),
  age: integer("age"),
  city: text("city"),
  country: text("country"),
  location: text("location"), // home studio
  flag: text("flag"),
  /** Free-text notes the studio keeps on a student (set when importing, editable in Customers). */
  notes: text("notes"),
  // GDPR consent (see lib/consent.ts). Each permission is stored on its own so
  // a student can allow photos but not videos, or withdraw promotional use and
  // keep the rest. gdprConsentAt / gdprConsentVersion record when the choices
  // were last made and to which wording.
  //   dataConsent  — contact & booking details (required to be a customer)
  //   photoConsent — photographs of them / their child
  //   videoConsent — video of them / their child
  //   promoConsent — using those photos & videos in marketing
  // mediaConsent stays as the "any media allowed" flag older code reads.
  mediaConsent: boolean("media_consent").notNull().default(false),
  dataConsent: boolean("data_consent").notNull().default(false),
  photoConsent: boolean("photo_consent").notNull().default(false),
  videoConsent: boolean("video_consent").notNull().default(false),
  promoConsent: boolean("promo_consent").notNull().default(false),
  gdprConsentAt: timestamp("gdpr_consent_at", { withTimezone: true }),
  gdprConsentVersion: text("gdpr_consent_version"),
  /** When the media permissions were last narrowed / withdrawn. */
  mediaConsentWithdrawnAt: timestamp("media_consent_withdrawn_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Customer lifecycle (students only) — separate from `status`, which switches
  // admin-panel accounts on/off. "active" | "paused" | "dropped".
  customerStatus: text("customer_status").notNull().default("active"),
  blacklisted: boolean("blacklisted").notNull().default(false),
  statusReason: text("status_reason"), // reason code for the current pause/drop-off/blacklist
  statusNote: text("status_note"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Customer status history ─────────────────────────
// Every pause / drop-off / resume / blacklist change, so a returning student's
// story stays on their original record and drop-off reasons can be analysed.
export const customerStatusLog = pgTable("customer_status_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "paused" | "dropped" | "resumed" | "blacklisted" | "unblacklisted"
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  reasonCode: text("reason_code"),
  note: text("note"),
  bookingId: text("booking_id"), // set when a new booking resumed the customer
  actorName: text("actor_name"), // admin who made the change; null when automatic
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Audit Logs (admin RBAC actions) ─────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // who performed it
  actorName: text("actor_name"), // denormalized so the log still reads if the actor is later deleted
  action: text("action").notNull(), // "user.created", "role.permissions_changed", ...
  module: text("module").notNull(), // "users" | "roles"
  targetType: text("target_type"), // "user" | "role"
  targetId: text("target_id"),
  oldValues: text("old_values"), // JSON string snapshot (never includes password fields)
  newValues: text("new_values"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Members (family booking — §13, P2) ─────────────────────────
export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dob: date("dob"),
  gender: text("gender"),
  relationship: relationshipEnum("relationship").notNull().default("child"),
  location: text("location"),
  mediaConsent: boolean("media_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Plans (§8) ─────────────────────────
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  interval: planIntervalEnum("interval").notNull(),
  price: integer("price").notNull(), // per interval, SEK
  currency: text("currency").notNull().default("SEK"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

// ───────────────────────── App settings (admin "Portal Settings") ─────────────────────────
// Small key/value store for portal-wide config (studio hourly rate, studio purposes,
// Book-a-Demo class types, …). Values are JSON-encoded.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Email templates + delivery log ─────────────────────────
// One row per template the admin has edited; a missing row means "use the
// built-in default" (src/lib/email/defaults.ts).
export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(), // "welcome" | "booking_class" | ...
  subject: text("subject").notNull(),
  heading: text("heading").notNull(),
  body: text("body").notNull(), // plain text + {{variables}}, **bold**, "- " lists
  buttonLabel: text("button_label"),
  buttonUrl: text("button_url"),
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── VAT master ─────────────────────────
// One row per booking type. A missing row means the built-in default in
// src/lib/vat.ts. Rates are stored in basis points (2500 = 25%).
export const vatRates = pgTable("vat_rates", {
  bookingType: text("booking_type").primaryKey(), // "class" | "workshop" | "event" | "studio"
  rateBp: integer("rate_bp").notNull().default(0),
  // "inclusive": the listed price already contains VAT.
  // "exclusive": VAT is added on top of the listed price at checkout.
  mode: text("mode").notNull().default("inclusive"),
  active: boolean("active").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateKey: text("template_key").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // "sent" | "failed" | "logged" (no provider configured)
  error: text("error"),
  // Stops the same confirmation going out twice (e.g. "booking_class:REG-123").
  dedupeKey: text("dedupe_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Coaches / Trainers (P2) ─────────────────────────
export const coaches = pgTable("coaches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  location: text("location"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Batches (admin-assigned classes — §7) ─────────────────────────
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  location: text("location").notNull(),
  mode: modeEnum("mode").notNull(),
  schedule: text("schedule"), // e.g. "Mon·Wed·Fri 7AM"
  coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
  capacity: integer("capacity").notNull().default(20),
  enrolled: integer("enrolled").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// ───────────────────────── Events / Workshops (§7) ─────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // "workshop" | "event"
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji"),
  date: text("date").notNull(),
  mode: modeEnum("mode").notNull(),
  location: text("location").notNull(),
  coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
  coach: text("coach"),
  price: integer("price").notNull().default(0),
  seatsLeft: integer("seats_left").notNull().default(0),
  seatsTotal: integer("seats_total").notNull().default(0),
  isPast: boolean("is_past").notNull().default(false),
  isOpen: boolean("is_open").notNull().default(true),
  couponCode: text("coupon_code"), // optional Discount Master code applied to this event
  // Structured date/time for conflict detection (display copy kept in `date`).
  eventDate: date("event_date"), // start date
  endDate: date("end_date"), // end date (range)
  startTime: time("start_time"),
  endTime: time("end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Event media (§19 — lazy-loaded assets) ─────────────────────────
export const eventMedia = pgTable("event_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "photo" | "video"
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

// ───────────────────────── Booking (central, polymorphic — §13) ─────────────────────────
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // e.g. "AF-0091"
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
  type: bookingTypeEnum("type").notNull(),
  location: text("location").notNull(),
  mode: modeEnum("mode"),
  status: bookingStatusEnum("status").notNull().default("pending"),
  planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().default("self"), // "self" | "admin"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Class booking (subtype)
export const classBookings = pgTable("class_bookings", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  level: text("level").notNull(),
  age: integer("age"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
});

// Workshop / event booking (subtype)
export const workshopBookings = pgTable("workshop_bookings", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
});

// Studio booking (subtype)
export const studioBookings = pgTable("studio_bookings", {
  bookingId: uuid("booking_id").primaryKey().references(() => bookings.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  hours: integer("hours").notNull().default(1),
  purpose: text("purpose").notNull(),
  notes: text("notes"),
  price: integer("price").notNull().default(0),
});

// ───────────────────────── Payment (one per booking — §8) ─────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("SEK"),
  method: paymentMethodEnum("method").notNull().default("swish"),
  state: paymentStateEnum("state").notNull().default("pending"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Receipt (one per successful payment — §8) ─────────────────────────
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  number: text("number").notNull().unique(), // e.g. "AF-2025-0091"
  pdfUrl: text("pdf_url"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Locations (admin-managed) ─────────────────────────
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(),
  country: text("country"),
  flag: text("flag"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Categories (admin-managed) ─────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Levels (admin-managed) ─────────────────────────
export const levels = pgTable("levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Announcements (admin broadcasts to students) ─────────────────────────
export const announcementToneEnum = pgEnum("announcement_tone", ["info", "warning", "urgent"]);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  tone: announcementToneEnum("tone").notNull().default("info"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Classes (admin-managed offerings with a fixed time) ─────────────────────────
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  location: text("location").notNull(),
  mode: modeEnum("mode").notNull(),
  days: text("days"), // e.g. "Mon, Wed, Fri"
  startDate: date("start_date"), // course runs from
  endDate: date("end_date"), // course runs until
  startTime: time("start_time").notNull(), // e.g. 10:00
  endTime: time("end_time").notNull(), // e.g. 12:00
  coach: text("coach"),
  price: integer("price").notNull().default(0), // SEK
  capacity: integer("capacity").notNull().default(20),
  active: boolean("active").notNull().default(true),
  // Zoom (online classes only). Created through the Zoom API, or pasted by an
  // admin (zoomMeetingId null). Only ever shown to students who booked the class.
  zoomMeetingId: text("zoom_meeting_id"),
  zoomJoinUrl: text("zoom_join_url"),
  zoomPassword: text("zoom_password"),
  zoomSyncedAt: timestamp("zoom_synced_at", { withTimezone: true }),
  zoomError: text("zoom_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Discounts (Discount Master) ─────────────────────────
export const discounts = pgTable("discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: discountTypeEnum("type").notNull().default("percent"),
  percent: integer("percent"), // 0–100, used when type='percent'
  flatAmount: integer("flat_amount"), // SEK, used when type='flat'
  scope: discountScopeEnum("scope").notNull().default("all"),
  target: text("target"), // category name, class id, or event id — null for scope=all/studio
  validFrom: date("valid_from"), // null = no start restriction
  validUntil: date("valid_until"), // null = no end restriction
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Studio blocks (admin blocks studio time) ─────────────────────────
export const studioBlocks = pgTable("studio_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  location: text("location").notNull(),
  date: date("date").notNull(), // start date
  endDate: date("end_date"), // end date (range); null = single day
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ───────────────────────── Registrations (denormalized admin view) ─────────────────────────
// Flat projection powering the "All Registrations" screen 1:1. Kept alongside the
// normalized tables above; in production this would be a view/materialized view.
export const registrations = pgTable("registrations", {
  id: text("id").primaryKey(), // e.g. "AF-0091"
  name: text("name").notNull(),
  email: text("email").notNull(),
  age: integer("age"),
  initial: text("initial"),
  color: text("color"),
  location: text("location").notNull(),
  flag: text("flag"),
  type: bookingTypeEnum("type").notNull(),
  detail: text("detail"),
  category: text("category"),
  level: text("level"),
  mode: modeEnum("mode"),
  period: text("period"),
  plan: text("plan"),
  paid: paymentStatusEnum("paid").notNull().default("onetime"),
  status: text("status").notNull(),
  statusTone: text("status_tone").notNull().default("gray"),
  amount: integer("amount").notNull().default(0), // SEK actually charged (after discount, incl. VAT)
  // VAT as it was when booked (a later change to the VAT master never rewrites
  // an old receipt). netAmount + vatAmount = amount.
  vatRateBp: integer("vat_rate_bp").notNull().default(0),
  vatMode: text("vat_mode"), // "inclusive" | "exclusive" | null (no VAT)
  vatAmount: integer("vat_amount").notNull().default(0),
  netAmount: integer("net_amount"),
  discountCode: text("discount_code"), // Discount Master code applied at checkout, if any
  // Price before the discount and the discount taken off (SEK, before VAT) —
  // recorded from now on so coupon reports show the exact revenue impact.
  baseAmount: integer("base_amount"),
  discountAmount: integer("discount_amount"),
  paymentMethod: paymentMethodEnum("payment_method"), // "stripe" | "swish" — how checkout was paid
  paymentRef: text("payment_ref"), // Stripe Checkout Session id, or Swish payment reference
  notes: text("notes"), // customer's own notes at booking, e.g. studio requirements
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }), // set for workshop/event bookings only
  // The class a class booking is for — used to stop the same person booking it twice.
  classId: uuid("class_id").references((): AnyPgColumn => classes.id, { onDelete: "set null" }),
  // Promotion link the customer came through before booking online, if any.
  promotionId: uuid("promotion_id").references((): AnyPgColumn => promotions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type RegistrationRow = typeof registrations.$inferSelect;

// ───────────────────────── Waitlist (full classes / workshops / events) ─────────────────────────
// First come, first served. When a seat frees up the next person is "offered"
// it by email and the seat is held for them until offerExpiresAt.
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: bookingTypeEnum("type").notNull(), // class | workshop | event
  classId: uuid("class_id").references((): AnyPgColumn => classes.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  // "waiting" | "offered" | "booked" | "expired" | "removed"
  status: text("status").notNull().default("waiting"),
  offeredAt: timestamp("offered_at", { withTimezone: true }),
  offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),
  bookingId: text("booking_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type WaitlistRow = typeof waitlist.$inferSelect;

// ───────────────────────── Bulk messages (admin announcements by email) ─────────────────────────
export const bulkMessages = pgTable("bulk_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  channel: text("channel").notNull().default("email"),
  audience: text("audience"), // JSON: the filters used
  audienceLabel: text("audience_label"), // human summary, e.g. "Class: Zumba · Stockholm"
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: text("status").notNull().default("sending"), // sending | sent | partial | failed | logged
  error: text("error"),
  announcementId: uuid("announcement_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

// ───────────────────────── Payment reminders (unpaid bookings) ─────────────────────────
// One row per reminder sent for a booking: step 1–3 escalate SMS → Email →
// WhatsApp; a channel that isn't set up yet falls back to email.
export const paymentReminders = pgTable("payment_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: text("registration_id").notNull(),
  step: integer("step").notNull(), // 1, 2, 3
  channel: text("channel").notNull(), // planned: sms | email | whatsapp
  sentVia: text("sent_via"), // what actually went out (e.g. email as fallback)
  status: text("status").notNull(), // sent | logged | failed | skipped
  error: text("error"),
  sentBy: text("sent_by"), // admin name, or null when automatic
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type PaymentReminderRow = typeof paymentReminders.$inferSelect;

// ───────────────────────── Invoices (one per paid booking) ─────────────────────────
// Numbered in order (INV-2026-0001) and frozen when issued: what the customer
// was charged, the VAT and the seller details at that moment.
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  registrationId: text("registration_id").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  description: text("description").notNull(),
  details: text("details"), // dates · plan · location
  bookingType: text("booking_type").notNull(),
  baseAmount: integer("base_amount"), // before discount, before VAT
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").notNull().default(0),
  netAmount: integer("net_amount").notNull(),
  vatRateBp: integer("vat_rate_bp").notNull().default(0),
  vatMode: text("vat_mode"),
  vatAmount: integer("vat_amount").notNull().default(0),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method"),
  paymentRef: text("payment_ref"),
  seller: text("seller"), // JSON snapshot of the business details printed on it
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
});

export type InvoiceRow = typeof invoices.$inferSelect;

// ───────────────────────── Enquiries ("Book a Demo" leads) ─────────────────────────
// Submitted by visitors who want info but haven't booked a specific class/event/
// studio session yet (those go straight into `registrations`). Reviewed by admin.
export const enquiries = pgTable("enquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  age: integer("age"),
  email: text("email").notNull(),
  phoneCountryCode: text("phone_country_code"), // e.g. "+91"
  phone: text("phone").notNull(),
  areaOfInterest: text("area_of_interest"),
  typeOfClass: text("type_of_class"),
  preferredLocation: text("preferred_location"),
  additionalInfo: text("additional_info"),
  consent: boolean("consent").notNull().default(false),
  status: text("status").notNull().default("new"), // "new" | "contacted" | "closed"
  // Where it came from: "demo" (Book a Demo) or "workshop" (a question about a workshop/event).
  kind: text("kind").notNull().default("demo"),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  // The promotion link the person arrived through (last click, 30 days).
  promotionId: uuid("promotion_id").references((): AnyPgColumn => promotions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EnquiryRow = typeof enquiries.$inferSelect;

// ───────────────────────── Promotions (trackable campaign links) ─────────────────────────
// Every promotion gets a link /p/<slug>. Clicks are counted, and enquiries and
// bookings made afterwards are tagged with it so each campaign's results show.
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  channel: text("channel").notNull().default("instagram"), // instagram | facebook | whatsapp | email | flyer | google | other
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }), // linked workshop/event
  landing: text("landing").notNull().default("workshops"), // workshops | class | studio | home
  startDate: date("start_date"),
  endDate: date("end_date"),
  active: boolean("active").notNull().default(true),
  clicks: integer("clicks").notNull().default(0),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type PromotionRow = typeof promotions.$inferSelect;
