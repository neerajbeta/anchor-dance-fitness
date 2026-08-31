import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listRoles, createRole, recordAuditLog, ConflictError, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listRoles() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("roles.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name?.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }
    const row = await createRole({ name: b.name, description: b.description });
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "role.created",
      module: "roles",
      targetType: "role",
      targetId: row.id,
      newValues: { name: row.name, slug: row.slug },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/roles]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
