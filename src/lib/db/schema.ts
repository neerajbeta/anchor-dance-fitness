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
  mediaConsent: boolean("media_consent").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
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
  amount: integer("amount").notNull().default(0), // SEK actually charged (after discount)
  discountCode: text("discount_code"), // Discount Master code applied at checkout, if any
  paymentMethod: paymentMethodEnum("payment_method"), // "stripe" | "swish" — how checkout was paid
  paymentRef: text("payment_ref"), // Stripe Checkout Session id, or Swish payment reference
  notes: text("notes"), // customer's own notes at booking, e.g. studio requirements
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }), // set for workshop/event bookings only
  // The class a class booking is for — used to stop the same person booking it twice.
  classId: uuid("class_id").references((): AnyPgColumn => classes.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type RegistrationRow = typeof registrations.$inferSelect;

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EnquiryRow = typeof enquiries.$inferSelect;
