import { NextRequest, NextResponse } from "next/server";
import { getStudioTakenSlots, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the student Studio Hire page greys out unavailable start times.
// Returns only time ranges for one location + day — no personal data.
export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location")?.trim();
  const date = req.nextUrl.searchParams.get("date")?.trim();
  if (!location || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "location and date (YYYY-MM-DD) are required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await getStudioTakenSlots(location, date) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/studio/taken]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
