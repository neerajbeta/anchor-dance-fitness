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
  | "admin_booking"
  | "waitlist_seat"
  | "bulk_message"
  | "invoice"
  | "payment_reminder";

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
  { name: "vat", label: "VAT", sample: "SEK 360 (25%, included)" },
  { name: "payment_status", label: "Payment status", sample: "Paid" },
  { name: "payment_method", label: "Payment method", sample: "Swish" },
  { name: "discount_code", label: "Discount code", sample: "WELCOME10" },
  { name: "notes", label: "Customer notes", sample: "First time — please share the parking info." },
  { name: "invoice_number", label: "Invoice number (paid bookings — PDF attached)", sample: "INV-2026-0012" },
  { name: "zoom_link", label: "Zoom join link (online classes)", sample: "https://us06web.zoom.us/j/81234567890?pwd=abc123" },
  { name: "zoom_password", label: "Zoom passcode (online classes)", sample: "482913" },
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
  {
    key: "waitlist_seat",
    name: "Waitlist — seat available",
    icon: "🎟️",
    trigger: "When a seat opens up in a full class, workshop or event and it's this person's turn on the waitlist",
    audience: "customer",
    variables: [
      ...COMMON_VARS,
      { name: "booking_type", label: "Class / Workshop / Event", sample: "Workshop" },
      { name: "title", label: "What they waited for", sample: "Bollywood Fusion Masterclass" },
      { name: "dates", label: "Date / schedule", sample: "Sat 10 Oct 2026 · 11:00–13:00" },
      { name: "location", label: "Location", sample: "Stockholm" },
      { name: "book_url", label: "Booking link", sample: "https://anchordancefitness.com/book/workshops" },
      { name: "expires", label: "Seat held until", sample: "Sun 11 Oct, 11:00" },
      { name: "hold_hours", label: "Hours the seat is held", sample: "24" },
    ],
    defaults: {
      subject: "A seat just opened up — {{title}} 🎟️",
      heading: "Good news, {{first_name}}!",
      body: [
        "Hi {{first_name}},",
        "A seat has opened up in **{{title}}** and you're next on the waitlist.",
        "- {{booking_type}}: {{title}}\n- When: {{dates}}\n- Location: {{location}}",
        "We're holding the seat for you for **{{hold_hours}} hours** (until {{expires}}). After that it goes to the next person in line.",
      ].join("\n\n"),
      buttonLabel: "Book my seat",
      buttonUrl: "{{book_url}}",
      enabled: true,
    },
  },
  {
    key: "bulk_message",
    name: "Bulk message / announcement",
    icon: "📣",
    trigger: "When an admin sends a message from Bulk Messages (holiday closure, new batch launch…)",
    audience: "customer",
    variables: [
      ...COMMON_VARS,
      { name: "subject", label: "Subject written by the admin", sample: "Studio closed on Midsummer's Eve" },
      {
        name: "message",
        label: "Message written by the admin",
        sample: "Our Stockholm studio is closed on **Friday 19 June** for Midsummer.\n\nClasses restart on Monday 22 June as usual. Glad midsommar! 🌼",
      },
    ],
    defaults: {
      subject: "{{subject}}",
      heading: "{{subject}}",
      body: ["Hi {{first_name}},", "{{message}}", "— The {{site_name}} team"].join("\n\n"),
      buttonLabel: "Open My Portal",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "invoice",
    name: "Invoice",
    icon: "🧾",
    trigger: "When an admin presses \"Email invoice\" (the invoice PDF is attached). Paid bookings also get it attached to their confirmation email.",
    audience: "customer",
    variables: [
      ...COMMON_VARS,
      { name: "invoice_number", label: "Invoice number", sample: "INV-2026-0012" },
      { name: "invoice_date", label: "Invoice date", sample: "21 September 2026" },
      { name: "booking_id", label: "Booking ID", sample: "AF-0124" },
      { name: "title", label: "What was bought", sample: "Bollywood Beginners · 18:00–19:00" },
      { name: "amount", label: "Total paid", sample: "SEK 1 145" },
    ],
    defaults: {
      subject: "Your invoice {{invoice_number}} from {{site_name}}",
      heading: "Here's your invoice",
      body: [
        "Hi {{first_name}},",
        "Please find your invoice **{{invoice_number}}** attached.",
        "- Booking: {{title}} ({{booking_id}})\n- Total paid: {{amount}}\n- Invoice date: {{invoice_date}}",
        "You can also download it any time from My Portal.",
      ].join("\n\n"),
      buttonLabel: "Open My Portal",
      buttonUrl: "{{portal_url}}",
      enabled: true,
    },
  },
  {
    key: "payment_reminder",
    name: "Payment reminder",
    icon: "🔔",
    trigger: "For an unpaid booking — up to 3 reminders (automatic on the schedule in Payment Reminders, or sent by an admin)",
    audience: "customer",
    variables: [
      ...COMMON_VARS,
      { name: "booking_id", label: "Booking ID", sample: "AF-0124" },
      { name: "title", label: "What was booked", sample: "Bollywood Beginners · 18:00–19:00" },
      { name: "dates", label: "Date / period", sample: "1 Oct 2026 – 31 Dec 2026" },
      { name: "amount", label: "Amount due", sample: "SEK 1 200" },
      { name: "days_unpaid", label: "Days since booking", sample: "6" },
      { name: "reminder_number", label: "Which reminder", sample: "2 of 3" },
    ],
    defaults: {
      subject: "Reminder: payment due for {{title}} ({{amount}})",
      heading: "A friendly payment reminder",
      body: [
        "Hi {{first_name}},",
        "We haven't received payment for your booking yet:",
        "- Booking: {{title}} ({{booking_id}})\n- Dates: {{dates}}\n- Amount due: **{{amount}}**",
        "You can pay at the studio or reply to this email and we'll send you a payment link. If you've already paid, thank you — please ignore this message.",
        "(Reminder {{reminder_number}})",
      ].join("\n\n"),
      buttonLabel: "Open My Portal",
      buttonUrl: "{{portal_url}}",
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
