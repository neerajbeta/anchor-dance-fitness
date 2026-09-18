import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminUserStats, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Header stat cards on the Users screen: Total / Active / Inactive / Admins & Managers.
export async function GET() {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getAdminUserStats() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ data: { total: 0, active: 0, inactive: 0, adminsAndManagers: 0 } });
    console.error("[api/admin-users/stats]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
