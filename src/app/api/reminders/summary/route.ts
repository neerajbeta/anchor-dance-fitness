import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminActor, hasPermission } from "@/lib/auth/permissions";
import { listUnpaidWithReminders } from "@/lib/services";
import { sweepRemindersSoon } from "@/lib/reminders";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the admin 🔔 bell shows: unpaid customers, reminders due and
 * escalations. Also sends due reminders in the background (at most every
 * 10 minutes). Admins without payment access get an empty bell.
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentAdminActor();
  if (!actor || !hasPermission(actor, "payments.view")) return NextResponse.json({ data: null });
  try {
    sweepRemindersSoon(publicOrigin(req));
    const items = (await listUnpaidWithReminders()).filter((u) => !u.blacklisted);
    const escalated = items.filter((u) => u.escalated);
    const due = items.filter((u) => u.due);
    const customers = new Set(items.map((u) => u.email)).size;
    // Most urgent first: escalated, then due, then oldest.
    const top = [...items]
      .sort((a, b) => Number(b.escalated) - Number(a.escalated) || Number(b.due) - Number(a.due) || b.daysUnpaid - a.daysUnpaid)
      .slice(0, 8)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        amount: u.amount,
        detail: u.detail,
        daysUnpaid: u.daysUnpaid,
        remindersSent: u.remindersSent,
        escalated: u.escalated,
        due: u.due,
        nextChannel: u.nextChannel,
      }));
    return NextResponse.json({
      data: {
        unpaid: items.length,
        customers,
        owed: items.reduce((s, u) => s + u.amount, 0),
        due: due.length,
        escalated: escalated.length,
        top,
      },
    });
  } catch (err) {
    console.error("[api/reminders/summary]", err);
    return NextResponse.json({ data: null });
  }
}
