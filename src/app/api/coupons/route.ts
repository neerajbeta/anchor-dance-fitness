import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, getCouponReport } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Discount code usage — ?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const auth = await requireAnyPermission(["discounts.view", "reports.view"]);
  if (!auth.ok) return auth.response;
  try {
    const from = req.nextUrl.searchParams.get("from") ?? "";
    const to = req.nextUrl.searchParams.get("to") ?? "";
    return NextResponse.json({ data: await getCouponReport({ from: ISO.test(from) ? from : undefined, to: ISO.test(to) ? to : undefined }) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/coupons]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
