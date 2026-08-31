"use client";

import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

type Status = "active" | "inactive";
type Role = { id: string; name: string; slug: string; status: Status; isSystemRole: boolean };
type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: Status;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type SortBy = "name" | "email" | "createdAt" | "lastLoginAt";

const PAGE_SIZE = 10;

export function UsersManager() {
  const { can, me } = usePermissions();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy,
      sortDir,
    });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter) params.set("roleId", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const j = await fetch(`/api/admin-users?${params}`).then((r) => r.json());
    setItems(j.data ?? []);
    setTotal(j.total ?? 0);
  }, [page, sortBy, sortDir, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((j) => setRoles((j.data ?? []).filter((r: Role) => r.status === "active")));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 whenever a filter changes (not on page/sort changes themselves).
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  function toggleSort(col: SortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
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
    try {
      if (editing) {
        if (editing.roleId !== roleId && !confirm(`Change ${editing.name}'s role? This changes what they can access.`)) {
          setBusy(false);
          return;
        }
        const res = await fetch(`/api/admin-users/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), roleId, status }),
        });
        const jr = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(jr.error || "Failed");
      } else {
        const password = String(fd.get("password") || "");
        const confirmPassword = String(fd.get("confirmPassword") || "");
        const res = await fetch("/api/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fd.get("name"),
            email: fd.get("email"),
            password,
            confirmPassword,
            roleId,
            status,
          }),
        });
        const jr = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(jr.error || "Failed");
      }
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

  function startEdit(u: AdminUser) {
    setEditing(u);
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

  async function toggleStatus(u: AdminUser) {
    const next: Status = u.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return;
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
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sortArrow = (col: SortBy) => (sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const canCreate = can("users.create");
  const canEdit = can("users.edit");
  const canDelete = can("users.delete");

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div className="card-title mb-0">👥 Users</div>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={startCreate}>
            + Add New User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          className="field"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-8 text-center text-[13px] text-muted">
          No users found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border-[1.5px] border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-cream/60 text-[11px] uppercase tracking-wide text-slate">
              <tr>
                <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("name")}>
                  Name{sortArrow("name")}
                </th>
                <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("email")}>
                  Email{sortArrow("email")}
                </th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("createdAt")}>
                  Created{sortArrow("createdAt")}
                </th>
                <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("lastLoginAt")}>
                  Last Login{sortArrow("lastLoginAt")}
                </th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-line bg-white">
                  <td className="px-3 py-2 font-bold text-ink">
                    {u.name}
                    {me?.id === u.id && <span className="ml-1.5 text-[10px] font-normal text-muted">(you)</span>}
                  </td>
                  <td className="px-3 py-2 text-slate">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="badge badge-brand">{u.roleName ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className={`badge ${u.status === "active" ? "badge-ok" : "badge-gray"}`}
                      disabled={!canEdit || me?.id === u.id}
                      onClick={() => toggleStatus(u)}
                      title={me?.id === u.id ? "You cannot change your own status" : "Toggle status"}
                    >
                      {u.status === "active" ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-muted">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)}>
                          Reset Password
                        </button>
                      )}
                      {canDelete && me?.id !== u.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
        <div>
          {total === 0 ? "0 users" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form
          onSubmit={submit}
          key={editing?.id ?? "new"}
          className="mt-4 rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5"
        >
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
            {editing ? `Edit user — ${editing.name}` : "Add new user"}
          </div>
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
                Select role *
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
          {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`}>
              {editing ? "Save Changes" : "+ Add User"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
