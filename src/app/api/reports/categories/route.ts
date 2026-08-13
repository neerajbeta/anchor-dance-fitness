import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { getCategoryReport, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-selling categories, filter by month (YYYY-MM) and location.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const month = req.nextUrl.searchParams.get("month") || undefined;
    const location = req.nextUrl.searchParams.get("location") || undefined;
    return NextResponse.json({ data: await getCategoryReport({ month, location }) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/reports/categories]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
