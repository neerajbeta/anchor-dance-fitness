import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processDueReminders } from "@/lib/reminders";
import { processWaitlist } from "@/lib/waitlist";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * For a scheduler (Azure timer, GitHub Actions, cron-job.org…): sends due
 * payment reminders and hands freed seats to waitlists. Call it hourly with
 *   Authorization: Bearer <CRON_SECRET>   (or ?key=<CRON_SECRET>)
 * Does nothing unless CRON_SECRET is set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("key") || "").trim();
  const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const origin = publicOrigin(req);
    const [reminders, offers] = await Promise.all([processDueReminders({ origin }), processWaitlist(undefined, { origin })]);
    return NextResponse.json({ data: { reminders, waitlistOffers: offers.length } });
  } catch (err) {
    console.error("[api/cron/reminders]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
