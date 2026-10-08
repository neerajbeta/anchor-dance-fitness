"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Status = "active" | "inactive";
type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: Status;
  isSystemRole: boolean;
  userCount: number;
};
type Permission = { id: string; name: string; slug: string; module: string; description: string | null };

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  users: "User Management",
  roles: "Role Management",
  classes: "Classes",
  categories: "Categories",
  levels: "Levels",
  locations: "Locations",
  discounts: "Discounts",
  plans: "Plans",
  events: "Events & Workshops",
  book_on_behalf: "Book on Behalf",
  studio: "Studio Bookings",
  payments: "Payments",
  enquiries: "Enquiries",
  customers: "Customers",
  announcements: "Announcements",
  settings: "Portal Settings",
};

// Fixed left-border/badge color per default role, so the card grid reads at a glance —
// matches the design mockup. Any other custom role falls back to the brand tone.
const ROLE_COLORS: Record<string, { hex: string; badge: string }> = {
  "super-admin": { hex: "#8B5CF6", badge: "badge-grape" },
  admin: { hex: "#3B82C4", badge: "badge-info" },
  manager: { hex: "#2E9E6B", badge: "badge-ok" },
  staff: { hex: "#E0972B", badge: "badge-warn" },
  coach: { hex: "#DC4A3D", badge: "badge-danger" },
};
const DEFAULT_ROLE_COLOR = { hex: "#EF5B2B", badge: "badge-brand" };

function roleColor(slug: string) {
  return ROLE_COLORS[slug] ?? DEFAULT_ROLE_COLOR;
}

export function RolesManager() {
  const { can } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [managingRole, setManagingRole] = useState<Role | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [matrixMsg, setMatrixMsg] = useState<string | null>(null);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [cardFilter, setCardFilter] = useState<"all" | "system" | "custom" | "active" | "inactive">("all");

  async function load() {
    const [r, p] = await Promise.all([
      fetch("/api/roles").then((res) => res.json()),
      fetch("/api/permissions").then((res) => res.json()),
    ]);
    const roleRows: Role[] = r.data ?? [];
    setRoles(roleRows);
    setPermissions(p.data ?? []);

    // Every role's permission set — small N, one round trip each, used for the summary tags on
    // each card and the "all roles at a glance" matrix below.
    const allSlugs = new Set<string>((p.data ?? []).map((perm: Permission) => perm.slug));
    const entries = await Promise.all(
      roleRows.map(async (role): Promise<[string, Set<string>]> => {
        if (role.isSystemRole) return [role.id, allSlugs];
        const j = await fetch(`/api/roles/${role.id}`).then((res) => res.json());
        return [role.id, new Set<string>(j.data?.permissionSlugs ?? [])];
      })
    );
    setRolePerms(Object.fromEntries(entries));
  }
  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const byModule = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!byModule.has(p.module)) byModule.set(p.module, []);
      byModule.get(p.module)!.push(p);
    }
    return Array.from(byModule.entries());
  }, [permissions]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch(editing ? `/api/roles/${editing.id}` : "/api/roles", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fd.get("name"), description: fd.get("description") }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      form.reset();
      setEditing(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(r: Role) {
    setEditing(r);
    setShowForm(true);
    setError(null);
  }
  function startCreate() {
    setEditing(null);
    setShowForm(true);
    setError(null);
  }
  function cancelForm() {
    setEditing(null);
    setShowForm(false);
    setError(null);
  }

  async function toggleRoleStatus(r: Role) {
    const next: Status = r.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !confirm(`Deactivate the "${r.name}" role? Users assigned to it keep their access until reassigned.`))
      return;
    const res = await fetch(`/api/roles/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to update role");
      return;
    }
    load();
  }

  async function remove(r: Role) {
    if (!confirm(`Delete the "${r.name}" role? This cannot be undone.`)) return;
    const res = await fetch(`/api/roles/${r.id}`, { method: "DELETE" });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to delete role");
      return;
    }
    if (managingRole?.id === r.id) setManagingRole(null);
    load();
  }

  function openMatrix(r: Role) {
    setMatrixMsg(null);
    setManagingRole(r);
    setChecked(new Set(rolePerms[r.id] ?? []));
  }

  function toggle(slug: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleModule(mod: string, modPermissions: Permission[], selectAll: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of modPermissions) {
        if (selectAll) next.add(p.slug);
        else next.delete(p.slug);
      }
      return next;
    });
  }

  async function saveMatrix() {
    if (!managingRole) return;
    setMatrixBusy(true);
    setMatrixMsg(null);
    try {
      const res = await fetch(`/api/roles/${managingRole.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionSlugs: Array.from(checked) }),
      });
      const jr = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(jr.error || "Failed");
      setMatrixMsg("Saved.");
      setRolePerms((prev) => ({ ...prev, [managingRole.id]: new Set(checked) }));
    } catch (err) {
      setMatrixMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setMatrixBusy(false);
    }
  }

  const canManagePermissions = can("roles.manage_permissions");
  const canEditRole = can("roles.edit");
  const canDeleteRole = can("roles.delete");

  // Which modules a role has at least one permission in — the compact tag list on each card.
  function moduleTagsFor(r: Role): string[] {
    if (r.isSystemRole) return ["All Modules"];
    const mySlugs = rolePerms[r.id] ?? new Set<string>();
    const mods = new Set(permissions.filter((p) => mySlugs.has(p.slug)).map((p) => p.module));
    return Array.from(mods).map((m) => MODULE_LABELS[m] ?? m);
  }

  const filteredRoles = roles.filter((r) => {
    if (cardFilter === "system") return r.isSystemRole;
    if (cardFilter === "custom") return !r.isSystemRole;
    if (cardFilter === "active") return r.status === "active";
    if (cardFilter === "inactive") return r.status === "inactive";
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Role Management</h1>
          <p className="text-[13px] text-slate">
            Define what each role can access. System roles cannot be deleted while in use.
          </p>
        </div>
        {can("roles.create") && (
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            + Create Role
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Filter:</span>
          {(
            [
              { value: "all", label: "All Roles" },
              { value: "system", label: "System Roles" },
              { value: "custom", label: "Custom Roles" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setCardFilter(o.value)}
              className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors ${
                cardFilter === o.value
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-slate hover:border-brand-400 hover:text-brand-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredRoles.map((r) => {
          const color = roleColor(r.slug);
          return (
            <div
              key={r.id}
              className="rounded-xl border-[1.5px] bg-white p-4 shadow-card"
              style={{ borderColor: `${color.hex}55`, borderLeftWidth: 4, borderLeftColor: color.hex }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`badge ${color.badge}`}>{r.name}</span>
                <div className="flex items-center gap-1.5">
                  {r.isSystemRole && <span className="badge badge-gray">System</span>}
                  {canEditRole && !r.isSystemRole ? (
                    <ToggleSwitch
                      checked={r.status === "active"}
                      onChange={() => toggleRoleStatus(r)}
                      label={r.status === "active" ? "Active" : "Inactive"}
                    />
                  ) : (
                    <span className={`badge ${r.status === "active" ? "badge-ok" : "badge-gray"}`}>{r.status}</span>
                  )}
                </div>
              </div>
              <div className="mb-1 text-[15px] font-bold text-ink">{r.name}</div>
              <div className="mb-2.5 text-[12px] text-slate">
                {r.description || "No description."}
                {" · "}
                {r.userCount} user{r.userCount === 1 ? "" : "s"}
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {moduleTagsFor(r).map((tag) => (
                  <span key={tag} className="badge badge-ok">
                    {tag}
                  </span>
                ))}
                {moduleTagsFor(r).length === 0 && <span className="badge badge-gray">No modules granted</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.isSystemRole ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openMatrix(r)}>
                    👁 View Permissions
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openMatrix(r)}>
                    ✏️ Edit Permissions
                  </button>
                )}
                {canEditRole && !r.isSystemRole && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>
                    Rename
                  </button>
                )}
                {canDeleteRole && !r.isSystemRole && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(r)}>
                    🗑 Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={cancelForm}>
          <form
            onSubmit={submit}
            key={editing?.id ?? "new"}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <div className="font-display text-lg font-bold text-ink">
                {editing ? "Edit Role" : "Create Role"}
              </div>
              <button type="button" className="text-xl leading-none text-muted" onClick={cancelForm} aria-label="Close">
                ×
              </button>
            </div>
            <p className="mb-4 text-[13px] text-slate">
              {editing ? `Update ${editing.name}'s name and description.` : "Custom roles start with no permissions — grant them from the card afterward."}
            </p>
            <div className="flex flex-col gap-3">
              <input name="name" className="field" placeholder="Role Name *" defaultValue={editing?.name} required />
              <input
                name="description"
                className="field"
                placeholder="Description (optional)"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
            <div className="mt-4 flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Cancel
              </button>
              <button className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>
                {busy ? "Saving…" : editing ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </form>
        </div>
      )}

      {managingRole && (
        <div className="card">
          <div className="mb-1 flex items-center justify-between">
            <div className="card-title mb-0">Permissions — {managingRole.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setManagingRole(null)}>
              Close
            </button>
          </div>
          {managingRole.isSystemRole ? (
            <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 p-3 text-[13px] text-muted">
              Super Admin always has full access to every module — this can't be changed.
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setChecked(new Set(permissions.map((p) => p.slug)))}
                >
                  Select All Permissions
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())}>
                  Clear All
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {grouped.map(([mod, modPermissions]) => {
                  const allOn = modPermissions.every((p) => checked.has(p.slug));
                  return (
                    <div key={mod} className="rounded-lg border-[1.5px] border-line bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[12px] font-bold uppercase tracking-wide text-slate">
                          {MODULE_LABELS[mod] ?? mod}
                        </div>
                        <label className="flex items-center gap-1.5 text-[11px] text-muted">
                          <input
                            type="checkbox"
                            checked={allOn}
                            onChange={(e) => toggleModule(mod, modPermissions, e.target.checked)}
                          />
                          Select All
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {modPermissions.map((p) => (
                          <label key={p.slug} className="flex items-center gap-1.5 text-[12px] text-ink">
                            <input type="checkbox" checked={checked.has(p.slug)} onChange={() => toggle(p.slug)} />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canManagePermissions && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className={`btn btn-primary btn-sm ${matrixBusy ? "is-disabled" : ""}`}
                    onClick={saveMatrix}
                  >
                    Save Permissions
                  </button>
                  {matrixMsg && <span className="text-[12px] text-slate">{matrixMsg}</span>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Permissions Matrix — all roles at a glance, read-only summary */}
      <div className="card">
        <div className="flex items-start justify-between gap-2">
          <div className="card-title">🔒 Permissions Matrix — All Roles at a Glance</div>
          <ExportExcelButton
            rows={permissions}
            filename="Role-permissions"
            sheetName="Permissions"
            notes={[`Permissions matrix — ${permissions.length} permissions across ${roles.length} roles`]}
            columns={[
              { label: "Module", value: (p) => MODULE_LABELS[p.module] ?? p.module },
              { label: "Permission", value: (p) => p.name },
              { label: "Slug", value: (p) => p.slug },
              ...roles.map((r) => ({
                label: r.name,
                value: (p: Permission) =>
                  (r.isSystemRole ? true : (rolePerms[r.id] ?? new Set<string>()).has(p.slug)) ? "Yes" : "No",
              })),
            ]}
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-slate">
          <span>✅ Full access</span>
          <span>🔶 Conditional / limited</span>
          <span>✗ No access</span>
        </div>
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>Module / Permission</th>
                {roles.map((r) => (
                  <th key={r.id}>
                    <span className={`badge ${roleColor(r.slug).badge}`}>{r.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(MODULE_LABELS).map((mod) => {
                const modPerms = permissions.filter((p) => p.module === mod);
                if (modPerms.length === 0) return null;
                return (
                  <tr key={mod}>
                    <td className="font-semibold text-ink">{MODULE_LABELS[mod]}</td>
                    {roles.map((r) => {
                      const mySlugs = r.isSystemRole ? new Set(permissions.map((p) => p.slug)) : rolePerms[r.id] ?? new Set<string>();
                      const have = modPerms.filter((p) => mySlugs.has(p.slug)).length;
                      const cell =
                        have === 0 ? (
                          <span className="text-muted">✗</span>
                        ) : have === modPerms.length ? (
                          <span title="Full access">✅</span>
                        ) : (
                          <span title="Conditional / limited">🔶</span>
                        );
                      return <td key={r.id}>{cell}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1.5"
      title={label}
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-ok" : "bg-line"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-1"
          }`}
        />
      </span>
      <span className={`text-[11px] font-semibold ${checked ? "text-ok" : "text-muted"}`}>{label}</span>
    </button>
  );
}
