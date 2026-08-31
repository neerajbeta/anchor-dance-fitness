"use client";

import { useEffect, useState } from "react";

export type AdminMe = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

/**
 * Client-side permission awareness for the admin panel: fetches the current actor + their
 * permission set once and exposes a `can(slug)` check for filtering nav/buttons/forms.
 *
 * This is DISPLAY ONLY — every sensitive action is re-checked server-side via
 * `requirePermission()` regardless of what this hook says, per the "never rely only on hiding
 * buttons in the UI" rule.
 */
export function usePermissions() {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((j) => {
        if (!cancelled) setMe(j.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function can(slug: string) {
    if (!me) return false;
    return me.isSuperAdmin || me.permissions.includes(slug);
  }

  return { me, loading, can };
}
