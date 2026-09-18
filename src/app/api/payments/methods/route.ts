import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { isSwishConfigured } from "@/lib/payments/swish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which gateways this deployment can actually take money through. No secrets leave here. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return NextResponse.json({
    data: { stripe: isStripeConfigured(), swish: await isSwishConfigured(origin) },
  });
}
