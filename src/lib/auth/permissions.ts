import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db/client";
import { users, roles } from "@/lib/db/schema";
import { getRolePermissionSlugs, getRoleBySlug, countActiveUsersInRole, getAdminUserById } from "@/lib/services";
import { getSession } from "./api";

/**
 * Reusable RBAC layer for the admin-panel User Management module.
 *
 * `users.role` (enum: student/admin/coach) still just gates whether an account can reach the
 * admin login at all — unchanged, so existing auth is untouched. `users.roleId` (new) points at
 * a row in `roles` and is what actually determines what a logged-in admin-panel account can see
 * and do; permissions are looked up fresh from the DB on every check (not embedded in the JWT),
 * so a permission change takes effect immediately without the user needing to log back in.
 */

export type AdminActor = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleSlug: string;
  roleName: string;
  status: "active" | "inactive";
  permissions: Set<string>;
};

// A session whose JWT already carries role="admin" but has no matching DB row/role assignment
// (no database configured, or the documented ADMIN_EMAIL/ADMIN_PASSWORD demo-login fallback in
// verify.ts) gets treated as Super Admin — exactly the access the old, pre-RBAC requireAdmin()
// granted any "admin" session. This is purely a degrade-gracefully path; a real DB user is
// always resolved through their actual assigned role instead (see below).
function demoSuperAdminActor(email: string, name: string): AdminActor {
  return {
    id: "demo-admin",
    email,
    name,
    roleId: "demo-super-admin",
    roleSlug: "super-admin",
    roleName: "Super Admin",
    status: "active",
    permissions: new Set(),
  };
}

/** Looks up the full actor (DB row + permission set) for the current admin session, or null. */
export async function getCurrentAdminActor(): Promise<AdminActor | null> {
  const session = await getSession();
  if (!session?.email) return null;
  if (session.role !== "admin") return null;
  if (!hasDb || !db) return demoSuperAdminActor(session.email, session.name);

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      status: users.status,
      roleId: users.roleId,
      roleSlug: roles.slug,
      roleName: roles.name,
      roleStatus: roles.status,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, session.email));

  if (!row) return demoSuperAdminActor(session.email, session.name); // e.g. demo fallback credentials
  if (!row.roleId || !row.roleSlug) return null; // real account, but not yet assigned a role
  if (row.status === "inactive" || row.roleStatus === "inactive") return null;

  const permissions = await getRolePermissionSlugs(row.roleId);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleId: row.roleId,
    roleSlug: row.roleSlug,
    roleName: row.roleName ?? row.roleSlug,
    status: row.status,
    permissions,
  };
}

export function isSuperAdmin(actor: AdminActor) {
  return actor.roleSlug === "super-admin";
}

export function hasPermission(actor: AdminActor, slug: string) {
  return isSuperAdmin(actor) || actor.permissions.has(slug);
}

/** Like requirePermission, but passes if the actor has ANY of the given slugs. */
export async function requireAnyPermission(
  slugs: string[]
): Promise<{ ok: true; actor: AdminActor } | { ok: false; response: NextResponse }> {
  const actor = await getCurrentAdminActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!slugs.some((slug) => hasPermission(actor, slug))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, actor };
}

/**
 * Guards against removing the last active Super Admin — via deactivation, deletion, or a role
 * change away from Super Admin. Returns an error string if the action would do that, else null.
 */
export async function checkLastSuperAdminGuard(targetUserId: string): Promise<string | null> {
  const target = await getAdminUserById(targetUserId);
  if (!target || target.status !== "active") return null; // already inactive/gone — nothing to protect
  const superAdmin = await getRoleBySlug("super-admin");
  if (!superAdmin || target.roleId !== superAdmin.id) return null; // not a Super Admin — nothing to protect
  const activeCount = await countActiveUsersInRole(superAdmin.id);
  if (activeCount <= 1) {
    return "This is the last active Super Admin — the app must always have at least one.";
  }
  return null;
}

/**
 * Route guard: resolves the current admin-panel actor and checks a specific permission slug
 * (e.g. "users.create"). Returns a 401/403 response to return directly on failure.
 */
export async function requirePermission(
  slug: string
): Promise<{ ok: true; actor: AdminActor } | { ok: false; response: NextResponse }> {
  const actor = await getCurrentAdminActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasPermission(actor, slug)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, actor };
}
