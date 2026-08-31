import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  listAdminUsers,
  createAdminUser,
  recordAuditLog,
  ConflictError,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-panel accounts only (anyone with a roleId assigned) — the student directory is
// untouched by this module. Supports search, filter by role/status, sort, and pagination.
export async function GET(req: NextRequest) {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const result = await listAdminUsers({
      search: sp.get("search") ?? undefined,
      roleId: sp.get("roleId") ?? undefined,
      status: (sp.get("status") as "active" | "inactive") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      sortBy: (sp.get("sortBy") as "name" | "email" | "createdAt" | "lastLoginAt") || undefined,
      sortDir: (sp.get("sortDir") as "asc" | "desc") || undefined,
    });
    return NextResponse.json({ data: result.rows, total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("users.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name?.trim() || !b?.email?.trim()) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
    }
    if (!b?.password || String(b.password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (b.password !== b.confirmPassword) {
      return NextResponse.json({ error: "Password and confirm password do not match" }, { status: 400 });
    }
    if (!b?.roleId) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }
    const row = await createAdminUser({
      name: b.name,
      email: b.email,
      password: b.password,
      roleId: b.roleId,
      status: b.status === "inactive" ? "inactive" : "active",
    });
    await recordAuditLog({
      userId: auth.actor.id,
      actorName: auth.actor.name,
      action: "user.created",
      module: "users",
      targetType: "user",
      targetId: row.id,
      newValues: { name: row.name, email: row.email, roleId: row.roleId, status: row.status },
    });
    // createAdminUser already returns an explicit, password-free column set.
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/admin-users]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
