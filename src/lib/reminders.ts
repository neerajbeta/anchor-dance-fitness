// Payment reminders for unpaid bookings. Server only.
//
// Up to 3 reminders per booking, escalating across channels in the order set
// in Payment Reminders (default SMS → Email → WhatsApp). SMS and WhatsApp need
// a provider (not connected yet); until then those steps go out by email and
// are recorded as such. After the 3rd reminder the booking is "escalated" —
// shown in the admin bell for a person to follow up.
//
// There's no background job: due reminders are sent when an admin opens the
// panel (at most every 10 minutes), from "Send due reminders now", or by a
// scheduler calling /api/cron/reminders with CRON_SECRET.

import {
  getReminderSettings,
  listUnpaidWithReminders,
  MAX_REMINDERS,
  recordPaymentReminder,
  type ReminderChannel,
} from "@/lib/services";
import { sendTemplateEmail } from "@/lib/email/send";

type Unpaid = Awaited<ReturnType<typeof listUnpaidWithReminders>>[number];

const SITE = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");

/** Is a channel's provider connected? SMS / WhatsApp come once a provider is chosen (Twilio / 46elks). */
export function channelReady(channel: ReminderChannel) {
  return channel === "email";
}

const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;

/** Sends the next reminder for one booking. Returns what happened. */
export async function sendReminder(item: Unpaid, opts: { sentBy?: string | null; origin?: string | null } = {}) {
  if (item.remindersSent >= MAX_REMINDERS || !item.nextStep || !item.nextChannel) {
    return { ok: false as const, message: "All 3 reminders have already been sent — follow up personally." };
  }
  const step = item.nextStep;
  const planned = item.nextChannel;
  // SMS / WhatsApp aren't connected yet → email instead, so the customer still hears from us.
  const name = item.name.trim();
  const site = SITE() || (opts.origin ?? "").replace(/\/$/, "") || "http://localhost:3000";
  const outcome = await sendTemplateEmail({
    key: "payment_reminder",
    to: item.email,
    vars: {
      name,
      first_name: name.split(/\s+/)[0] || name,
      email: item.email,
      portal_url: `${site}/portal`,
      site_name: "Anchor Dance & Fitness",
      booking_id: item.id,
      title: item.detail || item.plan || "your booking",
      dates: item.period ?? "",
      amount: sek(item.amount),
      days_unpaid: String(item.daysUnpaid),
      reminder_number: `${step} of ${MAX_REMINDERS}`,
    },
    dedupeKey: `payment_reminder:${item.id}:${step}`,
  });
  const status = outcome === "sent" ? "sent" : outcome === "logged" ? "logged" : outcome === "duplicate" ? "sent" : "failed";
  await recordPaymentReminder({
    registrationId: item.id,
    step,
    channel: planned,
    sentVia: planned === "email" ? "email" : `email (${planned} not connected)`,
    status,
    error: outcome === "failed" ? "Email failed — see Email Templates → recent sends" : outcome === "disabled" ? "Payment reminder template is switched off" : null,
    sentBy: opts.sentBy,
  });
  const message =
    status === "failed"
      ? "Sending failed."
      : outcome === "logged"
      ? "Recorded, but email isn't set up on this server (POSTMARK_SERVER_TOKEN) — nothing was sent."
      : `Reminder ${step} of ${MAX_REMINDERS} sent by email${planned !== "email" ? ` (${planned.toUpperCase()} not connected yet)` : ""}.`;
  return { ok: status !== "failed", message };
}

/** Sends every reminder that's due (automatic schedule). Skips blacklisted customers. */
export async function processDueReminders(opts: { origin?: string | null; force?: boolean } = {}) {
  const settings = await getReminderSettings();
  if (!settings.enabled && !opts.force) return { sent: 0, failed: 0, skipped: 0 };
  const due = (await listUnpaidWithReminders()).filter((u) => u.due && !u.blacklisted);
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const item of due) {
    const r = await sendReminder(item, { origin: opts.origin });
    if (r.ok) sent++;
    else failed++;
  }
  return { sent, failed, skipped };
}

let lastSweep = 0;
/** Automatic reminders, at most every 10 minutes (called when admins use the panel). */
export function sweepRemindersSoon(origin?: string | null) {
  const now = Date.now();
  if (now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  void processDueReminders({ origin }).catch((err) => console.error("[reminders] sweep failed:", err));
}
