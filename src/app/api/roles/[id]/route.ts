import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getRoleById,
  updateRole,
  deleteRole,
  getRolePermissionSlugs,
  recordAuditLog,
  ConflictError,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return auth.response;
  try {
    const role = await getRoleById(params.id);
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const permissionSlugs = Array.from(await getRolePermissionSlugs(params.id));
    return NextResponse.json({ data: { ...role, permissionSlugs } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("roles.edit");
  if (!auth.ok) return auth.response;
  try {
    const before = await getRoleById(params.id);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const b = await req.json();
    const row = await updateRole(params.id, {
      name: b.name,
      description: b.description,
      status: b.status,
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "role.updated",
      module: "roles",
      targetType: "role",
      targetId: row.id,
      oldValues: { name: before.name, description: before.description, status: before.status },
      newValues: { name: row.name, description: row.description, status: row.status },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("roles.delete");
  if (!auth.ok) return auth.response;
  try {
    const before = await getRoleById(params.id);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteRole(params.id);
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "role.deleted",
      module: "roles",
      targetType: "role",
      targetId: params.id,
      oldValues: { name: before.name, slug: before.slug },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
