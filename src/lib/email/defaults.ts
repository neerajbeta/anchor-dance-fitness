/**
 * The emails the portal sends, with their built-in wording. Admins can
 * override any of them in Admin → Email Templates; a template that was never
 * edited falls back to what's here. Safe to import on the client (no server code).
 */

export type EmailTemplateKey =
  | "welcome"
  | "booking_class"
  | "booking_workshop"
  | "booking_event"
  | "booking_studio"
  | "admin_booking";

export type EmailTemplateContent = {
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
  enabled: boolean;
};

export type EmailVariable = { name: string; label: string; sample: string };

export type EmailTemplateDef = {
  key: EmailTemplateKey;
  name: string;
  icon: string;
  /** When it goes out — shown to the admin. */
  trigger: string;
  /** Who receives it: the customer, or the admin addresses set on the template. */
  audience: "customer" | "admin";
  variables: EmailVariable[];
  defaults: EmailTemplateContent;
};

const COMMON_VARS: EmailVariable[] = [
  { name: "name", label: "Full name", sample: "Priya Sharma" },
  { name: "first_name", label: "First name", sample: "Priya" },
  { name: "email", label: "Email", sample: "priya@example.com" },
  { name: "portal_url", label: "My Portal link", sample: "https://anchordancefitness.com/portal" },
  { name: "site_name", label: "Business name", sample: "Anchor Dance & Fitness" },
];

const BOOKING_VARS: EmailVariable[] = [
  ...COMMON_VARS,
  { name: "booking_id", label: "Booking ID", sample: "REG-1042" },
  { name: "booking_type", label: "Booking type", sample: "Class" },
  { name: "title", label: "What was booked", sample: "Bollywood Beginners · 18:00–19:00" },
  { name: "dates", label: "Date / period", sample: "1 Oct 2026 – 31 Dec 2026" },
  { name: "plan", label: "Plan", sample: "Quarterly" },
  { name: "location", label: "Location", sample: "Stockholm" },
  { name: "mode", label: "Online / In-Person", sample: "In-Person" },
  { name: "amount", label: "Amount paid", sample: "SEK 1 800" },
  { name: "payment_status", label: "Payment status", sample: "Paid" },
  { name: "payment_method", label: "Payment method", sample: "Swish" },
  { name: "discount_code", label: "Discount code", sample: "WELCOME10" },
  { name: "notes", label: "Customer notes", sample: "First time — please share the parking info." },
  {
    name: "booking_details",
    label: "Booking details table",
    sample: "(a formatted table of every booking field)",
  },
];

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    key: "welcome",
    name: "Welcome email",
    icon: "👋",
    trigger: "When a student creates an account",
    audience: "customer",
    variables: COMMON_VARS,
    defaults: {
      subject: "Welcome to {{site_name}}, {{first_name}}! 💃",
      heading: "Welcome aboard, {{first_name}}!",
      body: [
        "Hi {{first_name}},",
        "Thanks for joining **{{site_name}}** — we're so happy to have you with us.",
        "From your portal you can:",
        "- Book a regular dance or fitness class",
        "- Join workshops and events",
        "- Hire the studio for your own practice",
        "- Keep track of your payments and receipts",
        "See you on the dance floor! 🎶",
      ].join("\n\n"),
      buttonLabel: "Go to My Portal",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "booking_class",
    name: "Class booking confirmed",
    icon: "💃",
    trigger: "When a class booking is paid, or booked by an admin",
    audience: "customer",
    variables: BOOKING_VARS,
    defaults: {
      subject: "Your class is booked — {{title}}",
      heading: "You're in, {{first_name}}! 🎉",
      body: [
        "Hi {{first_name}},",
        "Your class booking is confirmed. Here are the details:",
        "{{booking_details}}",
        "Please arrive 10 minutes early for your first class. If you have any questions, just reply to this email.",
      ].join("\n\n"),
      buttonLabel: "View my classes",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "booking_workshop",
    name: "Workshop booking confirmed",
    icon: "🎭",
    trigger: "When a workshop booking is paid, or booked by an admin",
    audience: "customer",
    variables: BOOKING_VARS,
    defaults: {
      subject: "Workshop booked — {{title}}",
      heading: "See you at the workshop! 🎭",
      body: [
        "Hi {{first_name}},",
        "Your seat at **{{title}}** is confirmed.",
        "{{booking_details}}",
        "Bring comfortable clothes, water and lots of energy!",
      ].join("\n\n"),
      buttonLabel: "View my bookings",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "booking_event",
    name: "Event booking confirmed",
    icon: "⭐",
    trigger: "When an event booking is paid, or booked by an admin",
    audience: "customer",
    variables: BOOKING_VARS,
    defaults: {
      subject: "You're going to {{title}} ⭐",
      heading: "Your event ticket is confirmed",
      body: [
        "Hi {{first_name}},",
        "Thanks for booking **{{title}}** — we can't wait to see you there.",
        "{{booking_details}}",
        "Show this email at the entrance if asked.",
      ].join("\n\n"),
      buttonLabel: "View my bookings",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "booking_studio",
    name: "Studio booking confirmed",
    icon: "🏛️",
    trigger: "When a studio hire is paid, or booked by an admin",
    audience: "customer",
    variables: BOOKING_VARS,
    defaults: {
      subject: "Studio booked — {{dates}}",
      heading: "The studio is yours 🏛️",
      body: [
        "Hi {{first_name}},",
        "Your studio hire is confirmed.",
        "{{booking_details}}",
        "Please leave the studio as you found it and finish on time — the next booking may start right after yours.",
      ].join("\n\n"),
      buttonLabel: "View my studio bookings",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "admin_booking",
    name: "New booking (to admin)",
    icon: "🔔",
    trigger: "To the admin team for every confirmed booking of any type",
    audience: "admin",
    variables: [
      ...BOOKING_VARS,
      { name: "phone", label: "Customer phone", sample: "070 123 45 67" },
      { name: "admin_url", label: "Admin page link", sample: "https://anchordancefitness.com/admin/registrations" },
    ],
    defaults: {
      subject: "🆕 New {{booking_type}} booking — {{name}} ({{amount}})",
      heading: "New {{booking_type}} booking",
      body: [
        "**{{name}}** ({{email}}) just booked **{{title}}**.",
        "{{booking_details}}",
        "Payment: {{payment_status}}",
      ].join("\n\n"),
      buttonLabel: "Open in admin",
      buttonUrl: "{{admin_url}}",
      enabled: true,
    },
  },
];

export function templateDef(key: string): EmailTemplateDef | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}

/** The template used to confirm a booking of this type. */
export function bookingTemplateKey(type: string): EmailTemplateKey {
  if (type === "workshop") return "booking_workshop";
  if (type === "event") return "booking_event";
  if (type === "studio") return "booking_studio";
  return "booking_class";
}

/** Sample values for the admin preview. */
export function sampleVariables(def: EmailTemplateDef): Record<string, string> {
  return Object.fromEntries(def.variables.map((v) => [v.name, v.sample]));
}
