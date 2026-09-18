// The emails the app sends on its own: welcome on signup, and a confirmation
// for every booking that's done (paid, free, or booked by an admin). Server only.

import { bookingTemplateKey } from "./defaults";
import type { DetailRow, EmailVars } from "./render";
import { sendTemplateEmail, type SendOutcome } from "./send";
import { getAdminEmailRecipients, getUserPhone } from "@/lib/services";

const SITE_NAME = "Anchor Dance & Fitness";

/** Public origin for links inside emails. */
function siteUrl(origin?: string | null) {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  return configured || (origin ?? "").replace(/\/$/, "") || "http://localhost:3000";
}

function baseVars(person: { name: string; email: string }, origin?: string | null): EmailVars {
  const name = person.name.trim();
  return {
    name,
    first_name: name.split(/\s+/)[0] || name,
    email: person.email,
    portal_url: `${siteUrl(origin)}/portal`,
    site_name: SITE_NAME,
  };
}

export function sendWelcomeEmail(user: { name: string; email: string }, origin?: string | null) {
  return sendTemplateEmail({
    key: "welcome",
    to: user.email,
    vars: baseVars(user, origin),
    dedupeKey: `welcome:${user.email.trim().toLowerCase()}`,
  });
}

type BookingRow = {
  id: string;
  name: string;
  email: string;
  type: string;
  detail: string | null;
  period: string | null;
  plan: string | null;
  location: string;
  mode: string | null;
  amount: number;
  paid: string;
  paymentMethod?: string | null;
  discountCode: string | null;
  notes?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  class: "Class",
  workshop: "Workshop",
  event: "Event",
  studio: "Studio Hire",
};

const PAID_LABEL: Record<string, string> = {
  paid: "Paid",
  pending: "Awaiting payment",
  overdue: "Payment due",
  onetime: "Waived",
};

const METHOD_LABEL: Record<string, string> = {
  stripe: "Card (Stripe)",
  swish: "Swish",
  external: "Paid at the studio",
  waived: "Waived",
};

const sek = (n: number) => (n > 0 ? `SEK ${n.toLocaleString("sv-SE")}` : "Free");

/**
 * Confirms a booking to the customer and tells the admin team about it. Safe to
 * call more than once for the same booking (the Swish callback and the result
 * page can both confirm a payment) — only the first call sends each email.
 */
export async function sendBookingConfirmation(row: BookingRow, origin?: string | null) {
  const [customer, admin] = await Promise.all([
    sendBookingEmails(row, origin, "customer"),
    sendBookingEmails(row, origin, "admin"),
  ]);
  return { customer, admin };
}

async function sendBookingEmails(
  row: BookingRow,
  origin: string | null | undefined,
  audience: "customer" | "admin"
): Promise<SendOutcome | "no-recipients"> {
  const key = bookingTemplateKey(row.type);
  const mode = row.mode === "online" ? "Online" : row.mode === "offline" ? "In-Person" : "";
  const paymentMethod =
    row.amount <= 0 ? "" : row.paymentMethod ? METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod : "";
  const paymentStatus = row.amount <= 0 ? "Free" : PAID_LABEL[row.paid] ?? row.paid;
  const detail = row.detail ?? "";

  const vars: EmailVars = {
    ...baseVars(row, origin),
    booking_id: row.id,
    booking_type: TYPE_LABEL[row.type] ?? row.type,
    title: detail,
    dates: row.period ?? "",
    plan: row.plan ?? "",
    location: row.location,
    mode,
    amount: sek(row.amount),
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    discount_code: row.discountCode ?? "",
    notes: row.notes ?? "",
  };

  const payment = paymentMethod ? `${paymentStatus} · ${paymentMethod}` : paymentStatus;
  let details: DetailRow[];
  if (row.type === "studio") {
    // Stored as "<date> · <start>–<end> · <purpose>".
    const [date, time, ...purpose] = detail.split(" · ");
    details = [
      ["Booking ID", row.id],
      ["Date", row.period || date || ""],
      ["Time", time ?? ""],
      ["Purpose", purpose.join(" · ")],
      ["Location", row.location],
      ["Amount", sek(row.amount)],
      ["Payment", payment],
      ["Discount", row.discountCode ?? ""],
      ["Your notes", row.notes ?? ""],
    ];
  } else {
    const isClass = row.type === "class";
    details = [
      ["Booking ID", row.id],
      [TYPE_LABEL[row.type] ?? "Booking", detail],
      [isClass ? "Dates" : "Date", row.period ?? ""],
      ["Plan", isClass ? row.plan ?? "" : ""],
      ["Location", row.location],
      ["Mode", mode],
      ["Amount", sek(row.amount)],
      ["Payment", payment],
      ["Discount", row.discountCode ?? ""],
      ["Your notes", row.notes ?? ""],
    ];
  }

  if (audience === "customer") {
    return sendTemplateEmail({ key, to: row.email, vars, details, dedupeKey: `${key}:${row.id}` });
  }

  try {
    const [{ emails }, phone] = await Promise.all([getAdminEmailRecipients(), getUserPhone(row.email)]);
    if (!emails.length) {
      console.info(`[email] no admin recipients set — skipped new-booking email for ${row.id}`);
      return "no-recipients";
    }
    const adminPage = row.type === "studio" ? "/admin/studio" : "/admin/registrations";
    return sendTemplateEmail({
      key: "admin_booking",
      to: emails.join(", "),
      vars: {
        ...vars,
        phone: phone ?? "",
        admin_url: `${siteUrl(origin)}${adminPage}`,
        footer_note: "Sent to the admin team for every confirmed booking.",
      },
      details: [
        details[0],
        ["Customer", `${row.name} · ${row.email}${phone ? ` · ${phone}` : ""}`],
        ...details.slice(1).map(([k, v]): DetailRow => [k === "Your notes" ? "Customer notes" : k, v]),
      ],
      dedupeKey: `admin_booking:${row.id}`,
    });
  } catch (err) {
    console.error(`[email] admin_booking for ${row.id} failed:`, err);
    return "failed";
  }
}
