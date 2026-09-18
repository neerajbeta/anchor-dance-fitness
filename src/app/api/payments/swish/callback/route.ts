import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { getRegistrationByPaymentRef, markRegistrationPaid } from "@/lib/services";
import { getSwishPaymentStatus } from "@/lib/payments/swish";
import { sendBookingConfirmation } from "@/lib/email/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Swish posts the finished payment here (only works when this host is publicly
 * reachable over HTTPS). The body is not authenticated, so it's treated purely
 * as a nudge: we re-read the real status from Swish over mTLS before believing
 * anything. Always answers 200 — Swish retries on any other status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const instructionId = String(body.id ?? "").replace(/-/g, "").toUpperCase();
    if (!instructionId) return NextResponse.json({ ok: true });

    const row = await getRegistrationByPaymentRef(instructionId);
    if (!row || row.paid === "paid") return NextResponse.json({ ok: true });

    const result = await getSwishPaymentStatus(instructionId);
    if (result.paid) {
      const paid = await markRegistrationPaid(row.id, "swish", instructionId);
      if (paid) void sendBookingConfirmation(paid, publicOrigin(req));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/payments/swish/callback]", err);
    return NextResponse.json({ ok: true });
  }
}
