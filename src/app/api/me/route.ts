import { NextResponse } from "next/server";
import { getCurrentAdminActor } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current admin-panel actor + their permission set — used to filter the sidebar and gate
// client-side UI (buttons, forms). Every sensitive action is still re-checked server-side;
// this is for display only, never the source of truth for authorization.
export async function GET() {
  const actor = await getCurrentAdminActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    data: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      roleName: actor.roleName,
      roleSlug: actor.roleSlug,
      isSuperAdmin: actor.roleSlug === "super-admin",
      permissions: Array.from(actor.permissions),
    },
  });
}
