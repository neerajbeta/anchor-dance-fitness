import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { listClasses, createClass, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: booking forms need the class list to auto-fill times.
export async function GET() {
  try {
    return NextResponse.json({ data: await listClasses() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/classes]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin only: add a class.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name || !b?.category || !b?.level || !b?.location || !b?.mode || !b?.startTime || !b?.endTime) {
      return NextResponse.json(
        { error: "name, category, level, location, mode, startTime and endTime are required" },
        { status: 400 }
      );
    }
    if (b.endTime <= b.startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }
    const row = await createClass({
      name: b.name,
      category: b.category,
      level: b.level,
      location: b.location,
      mode: b.mode,
      days: b.days,
      startDate: b.startDate,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime: b.endTime,
      coach: b.coach,
      price: Number(b.price) || 0,
      capacity: Number(b.capacity) || 20,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/classes]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
