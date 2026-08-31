import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getActiveClassSessions, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drill-down behind the Reports "Active Classes" tile: every active class plus how many
// concrete sessions it actually runs (not just the catalog count).
export async function GET(req: NextRequest) {
  const auth = await requirePermission("reports.view");
  if (!auth.ok) return auth.response;
  try {
    const location = req.nextUrl.searchParams.get("location") || undefined;
    return NextResponse.json({ data: await getActiveClassSessions(location) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ data: { classes: [], totalSessions: 0 } });
    console.error("[api/reports/active-sessions]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
