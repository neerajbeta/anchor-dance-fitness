import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getStudioBookings } from "@/lib/stats";
import { createStudioBlock, listStudioBlocks, DbNotConfiguredError } from "@/lib/services";
import { isStudioLocation, STUDIO_LOCATION_ERROR } from "@/lib/studioLocations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePermission("studio.view");
  if (!auth.ok) return auth.response;
  try {
    const [bookings, blocks] = await Promise.all([getStudioBookings(), listStudioBlocks()]);
    return NextResponse.json({ data: { bookings, blocks } });
  } catch (err) {
    return handle(err);
  }
}

// Blocks a studio slot (maintenance/private use) — not a student booking.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("studio.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.location || !b?.date || !b?.startTime || !b?.endTime) {
      return NextResponse.json(
        { error: "location, date, startTime and endTime are required" },
        { status: 400 }
      );
    }
    if (!isStudioLocation(b.location)) {
      return NextResponse.json({ error: STUDIO_LOCATION_ERROR }, { status: 400 });
    }
    if (b.endTime <= b.startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }
    const row = await createStudioBlock({
      location: b.location,
      date: b.date,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime: b.endTime,
      reason: b.reason,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/studio]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
