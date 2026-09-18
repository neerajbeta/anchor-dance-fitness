import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import { getActiveBookedIds, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET → { classIds, eventIds } the signed-in student already holds, so the
 * booking pages can show "Already booked" instead of letting them book twice.
 * Signed out → empty lists (the checkout still checks by email).
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ data: { classIds: [], eventIds: [] } });
  try {
    return NextResponse.json({ data: await getActiveBookedIds(session.email) });
  } catch (err) {
    if (!(err instanceof DbNotConfiguredError)) console.error("[api/my-bookings]", err);
    return NextResponse.json({ data: { classIds: [], eventIds: [] } });
  }
}
