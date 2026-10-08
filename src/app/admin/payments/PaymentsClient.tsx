"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import type { Registration } from "@/lib/data";
import type { PaymentStats } from "@/lib/stats";

export function PaymentsClient({ stats }: { stats: PaymentStats }) {
  const rows = stats.rows;
  const [payment, setPayment] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [q, setQ] = useState("");
  const [locOpts, setLocOpts] = useState<{ id: string; label: string; flag: string | null }[]>([]);

  // Invoice numbers by booking id (paid bookings get one when first downloaded/emailed or paid online).
  const [invoices, setInvoices] = useState<Record<string, { number: string; emailedAt: string | null }>>({});
  const [emailing, setEmailing] = useState<string | null>(null);
  const loadInvoices = () =>
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((j) =>
        setInvoices(Object.fromEntries(((j.data ?? []) as { registrationId: string; number: string; emailedAt: string | null }[]).map((i) => [i.registrationId, i])))
      )
      .catch(() => {});

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocOpts(j.data ?? []));
    loadInvoices();
  }, []);

  async function emailInvoice(r: Registration) {
    if (!confirm(`Email the invoice for ${r.id} to ${r.email}?`)) return;
    setEmailing(r.id);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(r.id)}/email`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      alert(j.data?.message ?? j.error ?? "Done");
      loadInvoices();
    } finally {
      setEmailing(null);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r: Registration) => {
      if (payment === "paid" && r.paid === "overdue") return false;
      if (payment === "overdue" && r.paid !== "overdue") return false;
      if (type === "class" && r.type !== "class") return false;
      if (type === "we" && r.type !== "workshop" && r.type !== "event") return false;
      if (type === "studio" && r.type !== "studio") return false;
      if (location && r.location !== location) return false;
      if (term && ![r.name, r.id, r.email].some((f) => f.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, payment, type, location, q]);

  return (
    <AdminShell>
      <SectionHead
        title="Payment Dashboard"
        sub="Classes · Workshops / Events · Studio"
        right={
          <div className="flex items-center gap-2">
            {stats.connected ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <ExportExcelButton
              rows={filtered}
              filename="Payments"
              notes={[`Payment Dashboard — ${filtered.length} of ${rows.length} bookings`]}
              columns={[
                { label: "Booking ID", value: (r) => r.id },
                { label: "Invoice no.", value: (r) => invoices[r.id]?.number ?? "" },
                { label: "Name", value: (r) => r.name },
                { label: "Email", value: (r) => r.email },
                { label: "Type", value: (r) => r.type },
                { label: "Detail", value: (r) => r.detail },
                { label: "Location", value: (r) => r.location },
                { label: "Period", value: (r) => r.period },
                { label: "Plan", value: (r) => r.plan },
                { label: "Amount (SEK)", value: (r) => r.amount ?? 0 },
                { label: "Discount code", value: (r) => r.discountCode ?? "" },
                { label: "Payment", value: (r) => r.paid },
                { label: "Status", value: (r) => r.status },
                { label: "Invoice emailed", value: (r) => invoices[r.id]?.emailedAt?.slice(0, 10) ?? "" },
              ]}
            />
            <a href="/admin/reminders" className="btn btn-primary btn-sm no-underline">
              📩 Bulk Reminders
            </a>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label="Paid This Month" value={String(stats.paidThisMonth)} tone="!text-ok" />
        <Stat label="Overdue" value={String(stats.overdue)} tone="!text-danger" />
        <Stat label="Due in 7 Days" value={String(stats.dueSoon)} tone="!text-warn" />
        <Stat label="Total Revenue" value={`SEK ${stats.revenue.toLocaleString()}`} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
        <div className="flex min-w-0 flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
          <span className="text-sm">🔍</span>
          <input
            className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none"
            placeholder="Search name, ID, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="">All Payments</option>
          <option value="paid">✓ Paid</option>
          <option value="overdue">✗ Overdue</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="class">Class</option>
          <option value="we">Workshop/Event</option>
          <option value="studio">Studio</option>
        </select>
        <select className="field min-w-0 flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locOpts.map((l) => (
            <option key={l.id} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>ID</th>
                <th>Student</th>
                <th>Location</th>
                <th>Type</th>
                <th>Category</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="text-3xl">💳</div>
                    <div className="mt-2 font-bold text-ink">
                      {rows.length === 0 ? "No payments yet" : "No matches"}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {rows.length === 0
                        ? "Payments appear here as students complete bookings."
                        : "Try clearing the filters."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[11px] text-muted">{r.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar letter={r.initial} color={r.color} size={26} /> {r.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {r.flag} {r.location}
                    </td>
                    <td className="capitalize">{r.type}</td>
                    <td className="text-[12px]">{r.category ?? "—"}</td>
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
                    <td className="whitespace-nowrap text-[12px]">
                      {r.paid === "paid" && (r.amount ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/api/invoices/${encodeURIComponent(r.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-600 hover:underline"
                            title="Open the invoice PDF"
                          >
                            🧾 {invoices[r.id]?.number ?? "Invoice"}
                          </a>
                          <button
                            className="btn btn-ghost btn-sm"
                            title={invoices[r.id]?.emailedAt ? `Emailed ${new Date(invoices[r.id].emailedAt!).toLocaleString()} — send again` : "Email the invoice to the customer"}
                            disabled={emailing === r.id}
                            onClick={() => emailInvoice(r)}
                          >
                            {emailing === r.id ? "…" : invoices[r.id]?.emailedAt ? "✉️✓" : "✉️"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 text-right text-[13px] text-muted">
        Showing {filtered.length} of {rows.length}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
