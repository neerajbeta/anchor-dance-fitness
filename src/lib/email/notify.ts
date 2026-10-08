// The emails the app sends on its own: welcome on signup, and a confirmation
// for every booking that's done (paid, free, or booked by an admin). Server only.

import { bookingTemplateKey } from "./defaults";
import { formatVatRate } from "@/lib/vat";
import type { DetailRow, EmailVars } from "./render";
import { sendTemplateEmail, type EmailAttachment, type SendOutcome } from "./send";
import { ensureInvoice, getAdminEmailRecipients, getUserPhone, getZoomLinkForClass, markInvoiceEmailed } from "@/lib/services";
import { invoiceFileName, renderInvoicePdf } from "@/lib/invoicePdf";

const SITE_NAME = "Anchor Dance & Fitness";

/** Public origin for links inside emails. */
function siteUrl(origin?: string | null) {
  const configured = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
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

/** The booking's invoice as a PDF attachment, or null (not paid / couldn't be made). */
async function invoiceAttachment(registrationId: string): Promise<{ id: string; number: string; file: EmailAttachment } | null> {
  try {
    const inv = await ensureInvoice(registrationId);
    if (!inv) return null;
    const pdf = await renderInvoicePdf(inv);
    return { id: inv.id, number: inv.number, file: { name: invoiceFileName(inv), content: pdf, contentType: "application/pdf" } };
  } catch (err) {
    console.error(`[invoice] attachment for ${registrationId} failed:`, err);
    return null;
  }
}

/**
 * Emails a booking's invoice (PDF attached) to the customer — the admin
 * "Email invoice" button. Sends every time it's pressed.
 */
export async function sendInvoiceEmail(registrationId: string, origin?: string | null, to?: string) {
  const invoice = await invoiceAttachment(registrationId);
  if (!invoice) return "not-invoiceable" as const;
  const inv = await ensureInvoice(registrationId);
  if (!inv) return "not-invoiceable" as const;
  const outcome = await sendTemplateEmail({
    key: "invoice",
    to: to?.trim() || inv.customerEmail,
    vars: {
      ...baseVars({ name: inv.customerName, email: inv.customerEmail }, origin),
      invoice_number: inv.number,
      booking_id: inv.registrationId,
      title: inv.description,
      amount: sek(inv.total),
      invoice_date: (inv.issuedAt ?? new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    },
    dedupeKey: `invoice:${inv.id}:${Date.now()}`,
    attachments: [invoice.file],
  });
  if (outcome === "sent") await markInvoiceEmailed(inv.id).catch(() => {});
  return outcome;
}

/** Tells the next person on a waitlist that a seat is theirs if they book in time. */
export function sendWaitlistSeatEmail(
  entry: { id: string; name: string; email: string; type: string; offerExpiresAt: Date | null; offeredAt: Date | null },
  target: { title: string; when: string; location: string; path: string },
  holdHours: number,
  origin?: string | null
) {
  const expires = entry.offerExpiresAt
    ? entry.offerExpiresAt.toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Stockholm",
      })
    : "";
  return sendTemplateEmail({
    key: "waitlist_seat",
    to: entry.email,
    vars: {
      ...baseVars(entry, origin),
      booking_type: TYPE_LABEL[entry.type] ?? entry.type,
      title: target.title,
      dates: target.when,
      location: target.location,
      book_url: `${siteUrl(origin)}${target.path}`,
      expires,
      hold_hours: String(holdHours),
    },
    // One email per offer (a later re-offer to the same person sends again).
    dedupeKey: `waitlist_seat:${entry.id}:${entry.offeredAt?.getTime() ?? 0}`,
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
  vatRateBp?: number;
  vatMode?: string | null;
  vatAmount?: number;
  paid: string;
  paymentMethod?: string | null;
  discountCode: string | null;
  notes?: string | null;
  classId?: string | null;
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
  const vatText =
    row.vatMode && row.vatAmount
      ? `${sek(row.vatAmount)} (${formatVatRate(row.vatRateBp ?? 0)}, ${row.vatMode === "exclusive" ? "added" : "included"})`
      : "";

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
    vat: vatText,
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
      ["VAT", vatText],
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
      ["VAT", vatText],
      ["Payment", payment],
      ["Discount", row.discountCode ?? ""],
      ["Your notes", row.notes ?? ""],
    ];
  }

  // Online class with a Zoom meeting → the join link goes in the email.
  const zoomLink = row.type === "class" && row.mode === "online" ? await getZoomLinkForClass(row.classId).catch(() => null) : null;
  if (zoomLink) {
    vars.zoom_link = zoomLink.joinUrl;
    vars.zoom_password = zoomLink.password ?? "";
    const at = details.findIndex(([k]) => k === "Mode");
    details.splice(at >= 0 ? at + 1 : details.length, 0, ["Zoom link", zoomLink.joinUrl], ["Zoom passcode", zoomLink.password ?? ""]);
  }

  if (audience === "customer") {
    // A paid booking gets its invoice attached (issued now if it isn't yet).
    const invoice = row.paid === "paid" && row.amount > 0 ? await invoiceAttachment(row.id) : null;
    const outcome = await sendTemplateEmail({
      key,
      to: row.email,
      vars: invoice ? { ...vars, invoice_number: invoice.number } : vars,
      details: invoice ? [...details, ["Invoice", `${invoice.number} (attached)`]] : details,
      dedupeKey: `${key}:${row.id}`,
      attachments: invoice ? [invoice.file] : undefined,
    });
    if (invoice && outcome === "sent") await markInvoiceEmailed(invoice.id).catch(() => {});
    return outcome;
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
