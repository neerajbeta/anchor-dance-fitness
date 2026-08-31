import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listPermissions, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full permission catalog, for the Roles & Permissions matrix UI. Requires roles.view since
// it's only ever used to build that screen.
export async function GET() {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listPermissions() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/permissions]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
