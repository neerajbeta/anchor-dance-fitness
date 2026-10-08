import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { classes, events } from "@/lib/db/schema";
import {
  createAnnouncement,
  createBulkMessage,
  DbNotConfiguredError,
  finishBulkMessage,
  listBulkMessages,
  recordAuditLog,
  resolveBulkAudience,
  type BulkAudience,
} from "@/lib/services";
import { sendBatch } from "@/lib/email/send";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TYPE_LABEL: Record<string, string> = { class: "Classes", workshop: "Workshops", event: "Events", studio: "Studio hire" };
const STATUS_LABEL: Record<string, string> = { active: "Active", paused: "Paused", dropped: "Dropped off" };

function cleanAudience(raw: unknown): BulkAudience {
  const a = (raw ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 200) : []);
  return {
    bookingTypes: list(a.bookingTypes).filter((t) => t in TYPE_LABEL),
    classIds: list(a.classIds),
    eventIds: list(a.eventIds),
    locations: list(a.locations),
    statuses: list(a.statuses).filter((s) => s in STATUS_LABEL),
    currentOnly: Boolean(a.currentOnly),
  };
}

/** "Classes · Zumba Beginners · Stockholm · Active · current students" */
async function describe(a: BulkAudience) {
  const parts: string[] = [];
  if (a.bookingTypes?.length) parts.push(a.bookingTypes.map((t) => TYPE_LABEL[t]).join(", "));
  if (db && a.classIds?.length) {
    const rows = await db.select({ name: classes.name }).from(classes).where(inArray(classes.id, a.classIds));
    parts.push(rows.map((r) => r.name).join(", "));
  }
  if (db && a.eventIds?.length) {
    const rows = await db.select({ title: events.title }).from(events).where(inArray(events.id, a.eventIds));
    parts.push(rows.map((r) => r.title).join(", "));
  }
  if (a.locations?.length) parts.push(a.locations.join(", "));
  parts.push((a.statuses?.length ? a.statuses : ["active"]).map((s) => STATUS_LABEL[s]).join(", "));
  if (a.currentOnly) parts.push("current bookings only");
  return parts.length === 1 && !a.bookingTypes?.length && !a.locations?.length ? `All customers · ${parts[0]}` : parts.join(" · ");
}

/** History of sent messages. */
export async function GET() {
  const auth = await requirePermission("announcements.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listBulkMessages() });
  } catch (err) {
    return handle(err);
  }
}

/**
 *  { action: "preview", audience }                          → who would get it
 *  { action: "send", subject, message, audience, announce } → send it
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("announcements.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const audience = cleanAudience(b?.audience);
    const recipients = await resolveBulkAudience(audience);

    if (b?.action === "preview") {
      return NextResponse.json({
        data: {
          count: recipients.length,
          label: await describe(audience),
          sample: recipients.slice(0, 25).map((r) => ({ name: r.name, email: r.email, location: r.location })),
        },
      });
    }

    if (b?.action !== "send") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const subject = String(b.subject ?? "").trim().slice(0, 150);
    const message = String(b.message ?? "").trim().slice(0, 5000);
    if (!subject || !message) return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
    if (!recipients.length) return NextResponse.json({ error: "Nobody matches this audience." }, { status: 400 });

    const label = await describe(audience);
    const row = await createBulkMessage({
      subject,
      message,
      audience,
      audienceLabel: label,
      recipientCount: recipients.length,
      createdBy: auth.actor.name,
    });

    const origin = publicOrigin(req);
    const site = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
    const result = await sendBatch({
      key: "bulk_message",
      blocks: { subject, message },
      recipients: recipients.map((r) => {
        const name = r.name.trim();
        return {
          email: r.email,
          vars: {
            name,
            first_name: name.split(/\s+/)[0] || name,
            email: r.email,
            portal_url: `${site}/portal`,
            site_name: "Anchor Dance & Fitness",
          },
        };
      }),
    });

    // Optionally also show it on the student portal.
    let announcementId: string | null = null;
    if (b.announce) {
      const ann = await createAnnouncement({
        title: subject,
        message: message.replace(/\*\*/g, ""),
        tone: b.tone === "warning" || b.tone === "urgent" ? b.tone : "info",
        expiresAt: b.announceUntil ? new Date(`${b.announceUntil}T23:59:59`) : null,
      });
      announcementId = ann?.id ?? null;
    }

    const status = !result.configured ? "logged" : result.failed === 0 ? "sent" : result.sent === 0 ? "failed" : "partial";
    await finishBulkMessage(row.id, {
      sent: result.sent,
      failed: result.failed,
      status,
      error: result.errors.join(" | ") || (!result.configured ? "Email isn't set up (no POSTMARK_SERVER_TOKEN) — nothing was sent." : null),
      announcementId,
    });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "bulk_message.sent",
      module: "announcements",
      targetType: "bulk_message",
      targetId: row.id,
      newValues: { subject, audience: label, recipients: recipients.length, sent: result.sent, failed: result.failed },
    });
    return NextResponse.json({ data: { id: row.id, status, recipients: recipients.length, sent: result.sent, failed: result.failed, errors: result.errors } });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/bulk-messages]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
