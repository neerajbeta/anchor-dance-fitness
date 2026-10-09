import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listEventMedia, addEventMedia, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("events.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listEventMedia(params.id) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/events/:id/media]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin adds media by URL — no file-upload/object-storage pipeline exists in this app yet, so a
// pasted link (photo or video) is the supported path for now.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("events.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.url?.trim()) {
      return NextResponse.json({ error: "A media URL is required" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(b.url.trim());
    } catch {
      return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "URL must start with http:// or https://" }, { status: 400 });
    }
    const type = b.type === "video" ? "video" : "photo";
    const row = await addEventMedia({ eventId: params.id, type, url: b.url });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/events/:id/media]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
