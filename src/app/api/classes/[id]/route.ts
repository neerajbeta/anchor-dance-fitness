import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { updateClass, deleteClass, DbNotConfiguredError, ConflictError } from "@/lib/services";
import { processWaitlist } from "@/lib/waitlist";
import { removeClassMeeting, syncClassMeeting } from "@/lib/zoom";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("classes.edit");
  if (!auth.ok) return auth.response;
  try {
    const patch = await req.json();
    const row = await updateClass(params.id, patch);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // More seats? Offer them to the waitlist.
    if (patch.capacity !== undefined) void processWaitlist({ kind: "class", id: params.id }, { origin: publicOrigin(req) });
    // Keep the Zoom meeting in step (time / days / dates / name / online ↔ in-person).
    if (["name", "days", "startDate", "endDate", "startTime", "endTime", "mode", "location", "category", "level", "coach"].some((k) => k in patch)) {
      await syncClassMeeting(params.id, "updated");
    }
    return NextResponse.json({ data: row });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("classes.delete");
  if (!auth.ok) return auth.response;
  try {
    // Remove its Zoom meeting too (a Zoom problem doesn't stop the delete).
    await removeClassMeeting(params.id, { keepRow: true }).catch((err) => console.error(`[zoom] delete meeting for ${params.id}:`, err));
    await deleteClass(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof ConflictError)
    return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/classes/:id]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
