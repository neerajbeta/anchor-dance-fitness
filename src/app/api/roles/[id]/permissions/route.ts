import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getRoleById,
  getRolePermissionSlugs,
  setRolePermissions,
  listPermissions,
  recordAuditLog,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Replaces a role's entire permission set. The Super Admin role is always full-access and is
// never editable here — it stays in sync automatically as new permissions are added.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("roles.manage_permissions");
  if (!auth.ok) return auth.response;
  try {
    const role = await getRoleById(params.id);
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (role.isSystemRole) {
      return NextResponse.json(
        { error: "The Super Admin role always has full access and cannot be edited." },
        { status: 400 }
      );
    }
    const b = await req.json();
    const slugsWanted: string[] = Array.isArray(b.permissionSlugs) ? b.permissionSlugs : [];
    const catalog = await listPermissions();
    const idBySlug = new Map(catalog.map((p) => [p.slug, p.id]));
    const permissionIds = slugsWanted.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id));

    const before = Array.from(await getRolePermissionSlugs(params.id));
    await setRolePermissions(params.id, permissionIds);
    const after = slugsWanted.filter((s) => idBySlug.has(s));

    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "role.permissions_changed",
      module: "roles",
      targetType: "role",
      targetId: params.id,
      oldValues: { permissions: before },
      newValues: { permissions: after },
    });
    return NextResponse.json({ data: { permissionSlugs: after } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles/:id/permissions]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
