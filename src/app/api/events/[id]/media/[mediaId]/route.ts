import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { deleteEventMedia, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { mediaId: string } }) {
  const auth = await requirePermission("events.edit");
  if (!auth.ok) return auth.response;
  try {
    await deleteEventMedia(params.mediaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/events/:id/media/:mediaId]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
