import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { listLocations, createLocation, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: booking forms need the location list.
export async function GET() {
  try {
    return NextResponse.json({ data: await listLocations() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/locations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin only: add a location.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.label?.trim()) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }
    const row = await createLocation({ label: b.label, country: b.country, flag: b.flag });
    if (!row) return NextResponse.json({ error: "Location already exists" }, { status: 409 });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/locations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
