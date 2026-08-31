import { NextResponse } from "next/server";
import { listStudioBlocks, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: booking calendars (admin + student) need blocked dates to grey
// them out. No personal data here, just location/date/time/reason.
export async function GET() {
  try {
    return NextResponse.json({ data: await listStudioBlocks() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/studio/blocks]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
