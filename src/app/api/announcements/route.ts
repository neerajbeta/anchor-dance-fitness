import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listAnnouncements, listAllAnnouncements, createAnnouncement, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: students read active, non-expired announcements on their portal.
// Admins (?admin=1) see everything, including expired ones, so they can manage them.
export async function GET(req: NextRequest) {
  const wantsAdmin = req.nextUrl.searchParams.get("admin") === "1";
  if (wantsAdmin) {
    const auth = await requirePermission("announcements.view");
    if (!auth.ok) return auth.response;
  }
  try {
    const data = wantsAdmin ? await listAllAnnouncements() : await listAnnouncements();
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/announcements]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin only: post a new announcement.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("announcements.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.title?.trim() || !b?.message?.trim()) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 });
    }
    const tone = ["info", "warning", "urgent"].includes(b.tone) ? b.tone : "info";
    let expiresAt: Date | null = null;
    if (b.expiresAt) {
      const d = new Date(b.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "expiresAt must be a valid date" }, { status: 400 });
      }
      expiresAt = d;
    }
    const row = await createAnnouncement({ title: b.title, message: b.message, tone, expiresAt });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/announcements]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
