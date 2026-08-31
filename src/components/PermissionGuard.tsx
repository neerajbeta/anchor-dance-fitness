"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/usePermissions";

/**
 * Hides `children` unless the current admin-panel actor has `permission`. Purely a UI
 * convenience — the corresponding API route always re-checks server-side, so hiding a button
 * here is about a clean UI, not security.
 */
export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
