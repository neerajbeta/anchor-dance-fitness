"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { type BookingType, type Registration } from "@/lib/data";

const TYPE_BADGE: Record<BookingType, { label: string; tone: string }> = {
  class: { label: "💃 Class", tone: "badge-info" },
  workshop: { label: "🎭 Workshop", tone: "badge-warn" },
  event: { label: "⭐ Event", tone: "badge-warn" },
  studio: { label: "🏛️ Studio", tone: "badge-grape" },
};

const CAT_COLOR: Record<string, string> = {
  Bollywood: "badge-danger",
  Zumba: "badge-info",
  Yoga: "badge-ok",
};

export function RegistrationsClient({
  rows,
  source,
}: {
  rows: Registration[];
  source: "database" | "mock";
}) {
  const [bookingType, setBookingType] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");

  const [locOpts, setLocOpts] = useState<{ id: string; label: string; flag: string | null }[]>([]);
  const [catOpts, setCatOpts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocOpts(j.data ?? []));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCatOpts(j.data ?? []));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (bookingType === "class" && r.type !== "class") return false;
      if (bookingType === "we" && r.type !== "workshop" && r.type !== "event") return false;
      if (bookingType === "studio" && r.type !== "studio") return false;
      if (location && r.location !== location) return false;
      if (category && r.category !== category) return false;
      if (status && !r.status.toLowerCase().includes(status)) return false;
      if (mode && r.mode !== mode) return false;
      if (
        term &&
        ![r.name, r.id, r.email, r.category ?? ""].some((f) => f.toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  }, [rows, bookingType, location, category, status, mode, q]);

  return (
    <AdminShell>
      <SectionHead
        title="All Registrations"
        sub="Every user & booking in one view — filter by type or location"
        right={
          <div className="flex items-center gap-2">
            <SourceBadge source={source} />
            <button className="btn btn-ghost btn-sm">📥 Export All</button>
          </div>
        }
      />

      {/* Toolbar — one line, no scroll: search + dropdowns shrink to fit */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
        {/* search */}
        <div className="flex min-w-0 flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
          <span className="text-sm">🔍</span>
          <input
            className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none"
            placeholder="Search name, ID, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {/* dropdowns */}
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
          <option value="">All Bookings</option>
          <option value="class">💃 Class</option>
          <option value="we">🎭 Workshop/Event</option>
          <option value="studio">🏛️ Studio</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locOpts.map((l) => (
            <option key={l.id} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {catOpts.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="risk">At Risk</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">All Modes</option>
          <option value="online">💻 Online</option>
          <option value="offline">🏃 In-Person</option>
        </select>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Total Users" value={String(filtered.length)} sub="Matching filters" />
        <Stat label="Class Bookings" value={String(filtered.filter((r) => r.type === "class").length)} sub="Yoga · Zumba · Bollywood" />
        <Stat label="Workshop / Event" value={String(filtered.filter((r) => r.type === "workshop" || r.type === "event").length)} sub="This view" />
        <Stat label="Studio Bookings" value={String(filtered.filter((r) => r.type === "studio").length)} sub="Confirmed" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Type</th>
                <th>Detail</th>
                <th>Category</th>
                <th>Level</th>
                <th>Mode</th>
                <th>Period</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-14 text-center">
                    <div className="text-3xl">🗒️</div>
                    <div className="mt-2 font-bold text-ink">
                      {rows.length === 0 ? "No registrations yet" : "No matches"}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {rows.length === 0 ? (
                        <>
                          Bookings created by students, or by an admin via{" "}
                          <span className="font-semibold text-brand-600">Book on Behalf</span>, will
                          appear here.
                        </>
                      ) : (
                        "Try clearing the filters or search."
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-[11px] text-muted">{r.id}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar letter={r.initial} color={r.color} size={26} />
                      <div>
                        <div className="font-bold">{r.name}</div>
                        <div className="text-[11px] text-muted">
                          {r.email} · Age {r.age}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {r.flag} {r.location}
                  </td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[r.type].tone}`}>
                      {TYPE_BADGE[r.type].label}
                    </span>
                  </td>
                  <td className="max-w-[160px] text-[12px]">{r.detail}</td>
                  <td>
                    {r.category ? (
                      <span className={`badge ${CAT_COLOR[r.category] ?? "badge-gray"}`}>
                        {r.category}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {r.level ? (
                      <span className="badge badge-gray">{r.level}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {r.mode ? (
                      <span className={`badge ${r.mode === "online" ? "badge-info" : "badge-ok"}`}>
                        {r.mode === "online" ? "💻" : "🏃"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-[11px]">{r.period}</td>
                  <td>
                    <span className="badge badge-gray">{r.plan}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold text-ink">SEK {(r.amount ?? 0).toLocaleString()}</span>
                    {r.discountCode && (
                      <div className="text-[10px] font-semibold text-ok">🏷️ {r.discountCode}</div>
                    )}
                  </td>
                  <td>
                    {r.paid === "overdue" ? (
                      <span className="badge badge-danger">✗ Overdue</span>
                    ) : (
                      <span className="badge badge-ok">✓ Paid</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${toneClass[r.statusTone]}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status.includes("Pending") ? (
                      <button className="btn btn-primary btn-sm">Assign Batch</button>
                    ) : r.statusTone === "danger" ? (
                      <div className="flex gap-1.5">
                        <button className="btn btn-ghost btn-sm">Edit</button>
                        <button className="btn btn-primary btn-sm">📩</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm">View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
        <span>
          Showing {filtered.length} of {rows.length} registrations
        </span>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm">← Prev</button>
          <button className="btn btn-primary btn-sm">1</button>
          <button className="btn btn-ghost btn-sm">2</button>
          <button className="btn btn-ghost btn-sm">Next →</button>
        </div>
      </div>
    </AdminShell>
  );
}

function SourceBadge({ source }: { source: "database" | "mock" }) {
  return source === "database" ? (
    <span className="badge badge-ok" title="Reading from PostgreSQL">
      ● Live database
    </span>
  ) : (
    <span className="badge badge-warn" title="No DATABASE_URL configured — showing bundled sample data">
      ● Sample data
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

