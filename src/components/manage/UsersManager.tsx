"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";
import { Avatar } from "@/components/ui";
import { LocationSelect } from "@/components/LocationSelect";

type Status = "active" | "inactive";
type Role = { id: string; name: string; slug: string; status: Status; isSystemRole: boolean };
type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: Status;
  roleId: string | null;
  roleName: string | null;
  phone: string | null;
  location: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};
type Stats = { total: number; active: number; inactive: number; adminsAndManagers: number };

type SortBy = "name" | "email" | "createdAt" | "lastLoginAt";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function toCsvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function UsersManager() {
  const { can, me } = usePermissions();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [locationValue, setLocationValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRoleId, setBulkRoleId] = useState("");
  const [showBulkRole, setShowBulkRole] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortDir });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("roleId", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const j = await fetch(`/api/admin-users?${params}`).then((r) => r.json());
    setItems(j.data ?? []);
    setTotal(j.total ?? 0);
    setSelected(new Set());
  }, [page, pageSize, sortBy, sortDir, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((j) => setRoles((j.data ?? []).filter((r: Role) => r.status === "active")));
    fetch("/api/admin-users/stats")
      .then((r) => r.json())
      .then((j) => setStats(j.data ?? null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  function refreshStats() {
    fetch("/api/admin-users/stats")
      .then((r) => r.json())
      .then((j) => setStats(j.data ?? null));
  }

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const roleId = String(fd.get("roleId") || "");
    const status = String(fd.get("status") || "active") as Status;
    const body = {
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone") || null,
      location: locationValue || null,
      roleId,
      status,
    };
    try {
      if (editing) {
        if (editing.roleId !== roleId && !confirm(`Change ${editing.name}'s role? This changes what they can access.`)) {
          setBusy(false);
          return;
        }
        const res = await fetch(`/api/admin-users/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const jr = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(jr.error || "Failed");
      } else {
        const password = String(fd.get("password") || "");
        const confirmPassword = String(fd.get("confirmPassword") || "");
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, password, confirmPassword }),
        });
        const jr = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(jr.error || "Failed");
      }
      form.reset();
      setEditing(null);
      setShowForm(false);
      load();
      refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(u: AdminUser) {
    setEditing(u);
    setLocationValue(u.location ?? "");
    setShowForm(true);
    setViewing(null);
    setError(null);
  }

  function startCreate() {
    setEditing(null);
    setLocationValue("");
    setShowForm(true);
    setError(null);
  }

  function cancelForm() {
    setEditing(null);
    setShowForm(false);
    setError(null);
  }

  async function toggleStatus(u: AdminUser) {
    const next: Status = u.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !confirm(`Lock ${u.name}'s account? They will no longer be able to log in.`)) return;
    const res = await fetch(`/api/admin-users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to update status");
      return;
    }
    load();
    refreshStats();
  }

  async function resetPassword(u: AdminUser) {
    if (!confirm(`Reset ${u.name}'s password? A new temporary password will be generated.`)) return;
    const res = await fetch(`/api/admin-users/${u.id}/reset-password`, { method: "POST" });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to reset password");
      return;
    }
    alert(`Temporary password for ${u.name}:\n\n${jr.data.tempPassword}\n\nShare this securely — it won't be shown again.`);
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.name}? This permanently removes their admin-panel account.`)) return;
    const res = await fetch(`/api/admin-users/${u.id}`, { method: "DELETE" });
    const jr = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(jr.error || "Failed to delete user");
      return;
    }
    if (editing?.id === u.id) cancelForm();
    if (viewing?.id === u.id) setViewing(null);
    load();
    refreshStats();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((u) => u.id))));
  }

  async function bulkApply(action: "activate" | "deactivate" | "delete") {
    const ids = Array.from(selected).filter((id) => id !== me?.id); // never touch yourself
    if (ids.length === 0) return;
    const verb = action === "activate" ? "activate" : action === "deactivate" ? "deactivate" : "delete";
    if (!confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${ids.length} user(s)?`)) return;
    setBusy(true);
    const results = await Promise.all(
      ids.map((id) =>
        action === "delete"
          ? fetch(`/api/admin-users/${id}`, { method: "DELETE" })
          : fetch(`/api/admin-users/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: action === "activate" ? "active" : "inactive" }),
            })
      )
    );
    setBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) alert(`${failed} of ${ids.length} failed (self-account and last-Super-Admin protections apply).`);
    load();
    refreshStats();
  }

  async function bulkChangeRole() {
    const ids = Array.from(selected).filter((id) => id !== me?.id);
    if (ids.length === 0 || !bulkRoleId) return;
    if (!confirm(`Change role for ${ids.length} user(s)?`)) return;
    setBusy(true);
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin-users/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId: bulkRoleId }),
        })
      )
    );
    setBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) alert(`${failed} of ${ids.length} failed.`);
    setShowBulkRole(false);
    setBulkRoleId("");
    load();
  }

  async function exportCsv() {
    const params = new URLSearchParams({ page: "1", pageSize: "1000", sortBy, sortDir });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("roleId", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const j = await fetch(`/api/admin-users?${params}`).then((r) => r.json());
    const rows: AdminUser[] = j.data ?? [];
    const header = ["Name", "Email", "Role", "Location", "Status", "Last Login", "Created"];
    const lines = [header.map(toCsvCell).join(",")];
    for (const u of rows) {
      lines.push(
        [
          u.name,
          u.email,
          u.roleName ?? "",
          u.location ?? "",
          u.status,
          u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never",
          new Date(u.createdAt).toLocaleDateString(),
        ]
          .map(toCsvCell)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortArrow = (col: SortBy) => (sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const canCreate = can("users.create");
  const canEdit = can("users.edit");
  const canDelete = can("users.delete");
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">User Management</h1>
          <p className="text-[13px] text-slate">
            Admin-panel accounts — Super Admin, Admin, Manager, Staff, Coach. Search, filter, sort, and manage access.
          </p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            + Add User
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className="stat">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{stats?.total ?? "—"}</div>
          <div className="stat-sub">All roles</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active</div>
          <div className="stat-value !text-ok">{stats?.active ?? "—"}</div>
          <div className="stat-sub">Can log in</div>
        </div>
        <div className="stat">
          <div className="stat-label">Inactive / Locked</div>
          <div className="stat-value !text-danger">{stats?.inactive ?? "—"}</div>
          <div className="stat-sub">Login disabled</div>
        </div>
        <div className="stat">
          <div className="stat-label">Admins &amp; Managers</div>
          <div className="stat-value">{stats?.adminsAndManagers ?? "—"}</div>
          <div className="stat-sub">Super Admin · Admin · Manager</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field w-64"
            placeholder="🔍 Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mx-1 h-6 w-px bg-line" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Role:</span>
          <PillGroup
            active={roleFilter}
            opts={[{ value: "", label: "All" }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
            onChange={setRoleFilter}
          />
          <div className="mx-1 h-6 w-px bg-line" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Status:</span>
          <PillGroup
            active={statusFilter}
            opts={[
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            onChange={setStatusFilter}
          />
          <button className="btn btn-ghost btn-sm ml-auto" onClick={exportCsv}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (canEdit || canDelete) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border-[1.5px] border-brand-400/40 bg-brand-50 px-3.5 py-2.5">
          <span className="text-[12px] font-bold text-ink">With selected ({selected.size}):</span>
          {canEdit && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkApply("activate")} disabled={busy}>
                Activate
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => bulkApply("deactivate")} disabled={busy}>
                Deactivate
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkRole((v) => !v)} disabled={busy}>
                Change Role
              </button>
            </>
          )}
          {canDelete && (
            <button className="btn btn-danger btn-sm" onClick={() => bulkApply("delete")} disabled={busy}>
              Delete
            </button>
          )}
          {showBulkRole && (
            <div className="flex items-center gap-1.5">
              <select className="field w-auto text-[12px]" value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)}>
                <option value="" disabled>
                  Select role
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={bulkChangeRole} disabled={!bulkRoleId || busy}>
                Apply
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card">
        {items.length === 0 ? (
          <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-8 text-center text-[13px] text-muted">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border-[1.5px] border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-cream/60 text-[11px] uppercase tracking-wide text-slate">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("name")}>
                    User{sortArrow("name")}
                  </th>
                  <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("email")}>
                    Email{sortArrow("email")}
                  </th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("lastLoginAt")}>
                    Last Login{sortArrow("lastLoginAt")}
                  </th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-t border-line bg-white">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelected(u.id)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar letter={u.name[0]?.toUpperCase() ?? "?"} size={26} />
                          <span className="font-bold text-ink">{u.name}</span>
                          {me?.id === u.id && <span className="text-[10px] font-normal text-muted">(you)</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className="badge badge-brand">{u.roleName ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-muted">{u.location ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`badge ${u.status === "active" ? "badge-ok" : "badge-gray"}`}>
                          {u.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            className="btn btn-ghost btn-sm"
                            title="View details"
                            onClick={() => setViewing((v) => (v?.id === u.id ? null : u))}
                          >
                            👁
                          </button>
                          {canEdit && (
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => startEdit(u)}>
                              ✏️
                            </button>
                          )}
                          {canEdit && me?.id !== u.id && (
                            <button
                              className="btn btn-ghost btn-sm"
                              title={u.status === "active" ? "Lock (deactivate)" : "Unlock (activate)"}
                              onClick={() => toggleStatus(u)}
                            >
                              {u.status === "active" ? "🔒" : "🔓"}
                            </button>
                          )}
                          {canEdit && (
                            <button className="btn btn-ghost btn-sm" title="Reset password" onClick={() => resetPassword(u)}>
                              🔑
                            </button>
                          )}
                          {canDelete && me?.id !== u.id && (
                            <button className="btn btn-danger btn-sm" title="Delete" onClick={() => remove(u)}>
                              🚫
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {viewing?.id === u.id && (
                      <tr className="border-t border-line bg-cream/30">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-4">
                            <div>
                              <span className="font-bold text-slate">Phone:</span> {u.phone || "—"}
                            </div>
                            <div>
                              <span className="font-bold text-slate">Location:</span> {u.location || "—"}
                            </div>
                            <div>
                              <span className="font-bold text-slate">Created:</span>{" "}
                              {new Date(u.createdAt).toLocaleDateString()}
                            </div>
                            <div>
                              <span className="font-bold text-slate">Role:</span> {u.roleName ?? "—"}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <div>
            {total === 0 ? "0 users" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 5)
              .map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === page ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </button>
            <select
              className="field w-auto py-1 text-[12px]"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={cancelForm}
        >
          <form
            onSubmit={submit}
            key={editing?.id ?? "new"}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <div className="font-display text-lg font-bold text-ink">
                {editing ? "Edit User" : "Add New User"}
              </div>
              <button type="button" className="text-xl leading-none text-muted" onClick={cancelForm} aria-label="Close">
                ×
              </button>
            </div>
            <p className="mb-4 text-[13px] text-slate">
              {editing ? `Update ${editing.name}'s account.` : "Manually create a user account and assign a role."}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input name="name" className="field" placeholder="Full Name *" defaultValue={editing?.name} required />
              <input
                name="email"
                type="email"
                className="field"
                placeholder="Email Address *"
                defaultValue={editing?.email}
                required
              />
              <input
                name="phone"
                className="field"
                placeholder="Contact Number (optional)"
                defaultValue={editing?.phone ?? ""}
              />
              <LocationSelect
                allOption="No location"
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
              />
              {!editing && (
                <>
                  <input
                    name="password"
                    type="password"
                    className="field"
                    placeholder="Password * (min. 6 characters)"
                    minLength={6}
                    required
                  />
                  <input
                    name="confirmPassword"
                    type="password"
                    className="field"
                    placeholder="Confirm Password *"
                    minLength={6}
                    required
                  />
                </>
              )}
              <select name="roleId" className="field" defaultValue={editing?.roleId ?? ""} required>
                <option value="" disabled>
                  Assign role *
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select name="status" className="field" defaultValue={editing?.status ?? "active"}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {error && <div className="mt-3 text-xs font-semibold text-danger">{error}</div>}
            <div className="mt-4 flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Cancel
              </button>
              <button className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>
                {busy ? "Saving…" : editing ? "Save Changes" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PillGroup({
  opts,
  active,
  onChange,
}: {
  opts: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors ${
            active === o.value
              ? "border-ink bg-ink text-white"
              : "border-line bg-white text-slate hover:border-brand-400 hover:text-brand-600"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
