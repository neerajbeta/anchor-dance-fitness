import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import {
  DbNotConfiguredError,
  getCapacityOverview,
  joinWaitlist,
  recordAuditLog,
  removeWaitlistEntry,
  searchStudents,
  WaitlistError,
} from "@/lib/services";
import { processWaitlist } from "@/lib/waitlist";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seats filled vs available for every class and upcoming event, with each waitlist. */
export async function GET(req: NextRequest) {
  const auth = await requireAnyPermission(["classes.view", "events.view"]);
  if (!auth.ok) return auth.response;
  try {
    // Hand out any seats that freed up before showing the numbers.
    await processWaitlist(undefined, { origin: publicOrigin(req) });
    return NextResponse.json({ data: await getCapacityOverview(), at: new Date().toISOString() });
  } catch (err) {
    return handle(err);
  }
}

/**
 * Waitlist actions:
 *  { action: "notify", kind, id }          → offer a seat to the next person now
 *  { action: "remove", entryId }           → take someone off the waitlist
 *  { action: "add", type, classId|eventId, email } → add an existing student
 */
export async function POST(req: NextRequest) {
  const auth = await requireAnyPermission(["classes.edit", "events.edit"]);
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const actor = { userId: auth.actor.id === "demo-admin" ? null : auth.actor.id, actorName: auth.actor.name };

    if (b?.action === "notify" && (b.kind === "class" || b.kind === "event") && b.id) {
      const offers = await processWaitlist({ kind: b.kind, id: b.id }, { force: true, origin: publicOrigin(req) });
      await recordAuditLog({ ...actor, action: "waitlist.notified", module: "capacity", targetType: b.kind, targetId: b.id, newValues: offers.map((o) => o.email) });
      return NextResponse.json({ data: { notified: offers.map((o) => ({ name: o.name, email: o.email })) } });
    }

    if (b?.action === "remove" && b.entryId) {
      const row = await removeWaitlistEntry(b.entryId);
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await recordAuditLog({ ...actor, action: "waitlist.removed", module: "capacity", targetType: "waitlist", targetId: row.id, oldValues: { email: row.email, status: row.status } });
      // If they were holding an offered seat, it goes to the next person.
      const id = row.classId ?? row.eventId;
      if (id) void processWaitlist({ kind: row.classId ? "class" : "event", id }, { origin: publicOrigin(req) });
      return NextResponse.json({ ok: true });
    }

    if (b?.action === "add" && b.email) {
      const [student] = (await searchStudents(String(b.email))).filter((s) => s.email === String(b.email).trim().toLowerCase());
      if (!student) return NextResponse.json({ error: "No student with that email." }, { status: 404 });
      const { entry, position } = await joinWaitlist({
        type: b.type,
        classId: b.classId,
        eventId: b.eventId,
        name: student.name,
        email: student.email,
      });
      await recordAuditLog({ ...actor, action: "waitlist.added", module: "capacity", targetType: "waitlist", targetId: entry.id, newValues: { email: entry.email } });
      return NextResponse.json({ data: { id: entry.id, position } }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof WaitlistError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/capacity]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
