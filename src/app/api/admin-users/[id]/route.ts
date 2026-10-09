import { NextRequest, NextResponse } from "next/server";
import { requirePermission, checkLastSuperAdminGuard } from "@/lib/auth/permissions";
import {
  getAdminUserById,
  updateAdminUser,
  deleteAdminUser,
  recordAuditLog,
  ConflictError,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("users.view");
  if (!auth.ok) return auth.response;
  try {
    const row = await getAdminUserById(params.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Edits name/email/role/status together (password is changed only via the reset-password
// action). Role changes require users.manage_roles on top of users.edit; a user may never
// change their own role or deactivate themselves, and the last active Super Admin can't be
// demoted or deactivated this way either.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return auth.response;
  try {
    const before = await getAdminUserById(params.id);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = await req.json();

    const patch: {
      name?: string;
      email?: string;
      roleId?: string;
      status?: "active" | "inactive";
      phone?: string | null;
      location?: string | null;
    } = {};
    if (b.name !== undefined) patch.name = b.name;
    if (b.email !== undefined) patch.email = b.email;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (b.location !== undefined) patch.location = b.location;

    if (b.roleId !== undefined && b.roleId !== before.roleId) {
      if (params.id === auth.actor.id) {
        return NextResponse.json({ error: "You cannot change your own role." }, { status: 403 });
      }
      if (!auth.actor.permissions.has("users.manage_roles") && auth.actor.roleSlug !== "super-admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const guardMsg = await checkLastSuperAdminGuard(params.id);
      if (guardMsg) return NextResponse.json({ error: guardMsg }, { status: 409 });
      patch.roleId = b.roleId;
    }

    if (b.status !== undefined && b.status !== before.status) {
      if (b.status === "inactive") {
        if (params.id === auth.actor.id) {
          return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 403 });
        }
        const guardMsg = await checkLastSuperAdminGuard(params.id);
        if (guardMsg) return NextResponse.json({ error: guardMsg }, { status: 409 });
      }
      patch.status = b.status;
    }

    const row = await updateAdminUser(params.id, patch);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "user.updated",
      module: "users",
      targetType: "user",
      targetId: row.id,
      oldValues: { name: before.name, email: before.email, roleId: before.roleId, status: before.status },
      newValues: { name: row.name, email: row.email, roleId: row.roleId, status: row.status },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("users.delete");
  if (!auth.ok) return auth.response;
  try {
    if (params.id === auth.actor.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 403 });
    }
    const before = await getAdminUserById(params.id);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const guardMsg = await checkLastSuperAdminGuard(params.id);
    if (guardMsg) return NextResponse.json({ error: guardMsg }, { status: 409 });

    await deleteAdminUser(params.id);
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "user.deleted",
      module: "users",
      targetType: "user",
      targetId: params.id,
      oldValues: { name: before.name, email: before.email },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
