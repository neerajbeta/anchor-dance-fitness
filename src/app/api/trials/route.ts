import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, getTrialReport } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trial sessions, whether each converted to a paid enrolment, and open "Book a Demo" requests. */
export async function GET() {
  const auth = await requireAnyPermission(["enquiries.view", "reports.view"]);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getTrialReport() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/trials]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
