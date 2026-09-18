import { NextRequest, NextResponse } from "next/server";
import { DbNotConfiguredError } from "@/lib/services";
import { checkPayment, PaymentNotFoundError } from "@/lib/payments/verify";
import { StripeApiError, StripeNotConfiguredError } from "@/lib/payments/stripe";
import { SwishApiError, SwishNotConfiguredError } from "@/lib/payments/swish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  ?id=AF-0116 → current payment state (success page + Swish polling).
 * POST { id }      → same, but closes the payment if it isn't paid (cancelled page).
 *
 * Returns only the state, method and amount — no names or emails, since
 * booking ids are guessable.
 */
async function handle(id: string, cancel: boolean, origin: string) {
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    return NextResponse.json({ data: await checkPayment(id, { cancel, origin }) });
  } catch (err) {
    if (err instanceof PaymentNotFoundError) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    if (err instanceof StripeNotConfiguredError || err instanceof SwishNotConfiguredError) {
      return NextResponse.json({ error: "Payments aren't available right now." }, { status: 503 });
    }
    if (err instanceof StripeApiError || err instanceof SwishApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[api/payments/verify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req.nextUrl.searchParams.get("id") ?? "", false, req.nextUrl.origin);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  return handle(String(body.id ?? ""), true, req.nextUrl.origin);
}
