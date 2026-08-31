import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { updateEvent, deleteEvent, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("events.edit");
  if (!auth.ok) return auth.response;
  try {
    const patch = await req.json();
    const ev = await updateEvent(params.id, patch);
    if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: ev });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("events.delete");
  if (!auth.ok) return auth.response;
  try {
    await deleteEvent(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/events/:id]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
