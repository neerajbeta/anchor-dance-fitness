"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

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
  roles: "Roles & Permissions",
};

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

  async function load() {
    const [r, p] = await Promise.all([
      fetch("/api/roles").then((res) => res.json()),
      fetch("/api/permissions").then((res) => res.json()),
    ]);
    setRoles(r.data ?? []);
    setPermissions(p.data ?? []);
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

  async function openMatrix(r: Role) {
    setMatrixMsg(null);
    setManagingRole(r);
    if (r.isSystemRole) {
      setChecked(new Set(permissions.map((p) => p.slug)));
      return;
    }
    const j = await fetch(`/api/roles/${r.id}`).then((res) => res.json());
    setChecked(new Set(j.data?.permissionSlugs ?? []));
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
    } catch (err) {
      setMatrixMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setMatrixBusy(false);
    }
  }

  const canManagePermissions = can("roles.manage_permissions");
  const canEditRole = can("roles.edit");
  const canDeleteRole = can("roles.delete");

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="card-title mb-0">🔐 Roles</div>
          {can("roles.create") && (
            <button className="btn btn-primary btn-sm" onClick={startCreate}>
              + Add New Role
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5"
            >
              <div>
                <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  {r.name}
                  {r.isSystemRole && <span className="badge badge-brand">System</span>}
                  <span className={`badge ${r.status === "active" ? "badge-ok" : "badge-gray"}`}>{r.status}</span>
                  <span className="badge badge-info">{r.userCount} user{r.userCount === 1 ? "" : "s"}</span>
                </div>
                {r.description && <div className="mt-0.5 text-[12px] text-slate">{r.description}</div>}
              </div>
              <div className="flex flex-shrink-0 gap-1.5">
                <button className="btn btn-ghost btn-sm" onClick={() => openMatrix(r)}>
                  Permissions
                </button>
                {canEditRole && !r.isSystemRole && (
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                )}
                {canEditRole && !r.isSystemRole && (
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleRoleStatus(r)}>
                    {r.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                )}
                {canDeleteRole && !r.isSystemRole && (
                  <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <form
            onSubmit={submit}
            key={editing?.id ?? "new"}
            className="mt-4 rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5"
          >
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
              {editing ? `Edit role — ${editing.name}` : "Add new role"}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="name" className="field" placeholder="Role Name *" defaultValue={editing?.name} required />
              <input
                name="description"
                className="field"
                placeholder="Description (optional)"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
            <div className="mt-3 flex gap-2">
              <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
                {editing ? "Save Changes" : "+ Add Role"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

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
    </div>
  );
}
