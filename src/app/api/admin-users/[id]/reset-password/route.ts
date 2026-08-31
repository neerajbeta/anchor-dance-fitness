import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminUserById, resetAdminUserPassword, recordAuditLog, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generates a one-time temporary password and returns it once. No transactional email is wired
// up in this app yet, so the admin hands it to the user out of band; the user should change it
// on next login.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return auth.response;
  try {
    const target = await getAdminUserById(params.id);
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tempPassword = await resetAdminUserPassword(params.id);
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "user.password_reset",
      module: "users",
      targetType: "user",
      targetId: params.id,
      // Never store the password itself, even temporarily, in the audit trail.
      newValues: { note: "Temporary password issued" },
    });
    return NextResponse.json({ data: { tempPassword } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users/:id/reset-password]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
