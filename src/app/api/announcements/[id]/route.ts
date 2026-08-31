import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { updateAnnouncement, deleteAnnouncement, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("announcements.edit");
  if (!auth.ok) return auth.response;
  try {
    const patch = await req.json();
    if (patch.expiresAt !== undefined) {
      if (patch.expiresAt === null) {
        patch.expiresAt = null;
      } else {
        const d = new Date(patch.expiresAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "expiresAt must be a valid date" }, { status: 400 });
        }
        patch.expiresAt = d;
      }
    }
    const row = await updateAnnouncement(params.id, patch);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/announcements/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("announcements.delete");
  if (!auth.ok) return auth.response;
  try {
    await deleteAnnouncement(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/announcements/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
