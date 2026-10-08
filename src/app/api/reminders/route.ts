import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  DbNotConfiguredError,
  getReminderSettings,
  listReminderHistory,
  listUnpaidWithReminders,
  recordAuditLog,
  saveReminderSettings,
} from "@/lib/services";
import { channelReady, processDueReminders, sendReminder } from "@/lib/reminders";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Unpaid bookings with reminder progress, the schedule settings and recent history. */
export async function GET() {
  const auth = await requirePermission("payments.view");
  if (!auth.ok) return auth.response;
  try {
    const [items, settings, history] = await Promise.all([listUnpaidWithReminders(), getReminderSettings(), listReminderHistory(40)]);
    return NextResponse.json({
      data: {
        items,
        settings,
        history,
        channels: { email: channelReady("email"), sms: channelReady("sms"), whatsapp: channelReady("whatsapp") },
      },
    });
  } catch (err) {
    return handle(err);
  }
}

/**
 *  { action: "send", id }   → send the next reminder for one booking now
 *  { action: "send-due" }   → send every reminder that's due now
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const origin = publicOrigin(req);
    const actor = { userId: auth.actor.id === "demo-admin" ? null : auth.actor.id, actorName: auth.actor.name };

    if (b?.action === "send" && b.id) {
      const item = (await listUnpaidWithReminders()).find((u) => u.id === b.id);
      if (!item) return NextResponse.json({ error: "That booking isn't unpaid any more." }, { status: 404 });
      const r = await sendReminder(item, { sentBy: auth.actor.name, origin });
      await recordAuditLog({ ...actor, action: "reminder.sent", module: "payments", targetType: "registration", targetId: item.id, newValues: { step: item.nextStep, result: r.message } });
      return NextResponse.json({ data: r }, { status: r.ok ? 200 : 409 });
    }

    if (b?.action === "send-due") {
      const r = await processDueReminders({ origin, force: true });
      await recordAuditLog({ ...actor, action: "reminder.sent_due", module: "payments", newValues: r });
      return NextResponse.json({ data: r });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handle(err);
  }
}

/** Save the schedule. */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const before = await getReminderSettings();
    const saved = await saveReminderSettings(await req.json());
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "reminder_settings.updated",
      module: "settings",
      oldValues: before,
      newValues: saved,
    });
    return NextResponse.json({ data: saved });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/reminders]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
