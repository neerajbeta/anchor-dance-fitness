import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, getRevenueReport } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Monthly revenue report — ?month=YYYY-MM&location=… */
export async function GET(req: NextRequest) {
  const auth = await requireAnyPermission(["reports.view", "payments.view"]);
  if (!auth.ok) return auth.response;
  try {
    const month = req.nextUrl.searchParams.get("month") ?? undefined;
    const location = req.nextUrl.searchParams.get("location") || undefined;
    return NextResponse.json({ data: await getRevenueReport({ month, location }) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/revenue]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
