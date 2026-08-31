import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listLevels, createLevel, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: booking/class forms need the level list.
export async function GET() {
  try {
    return NextResponse.json({ data: await listLevels() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/levels]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin only: add a level.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("levels.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const row = await createLevel(b.name);
    if (!row) return NextResponse.json({ error: "Level already exists" }, { status: 409 });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/levels]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
