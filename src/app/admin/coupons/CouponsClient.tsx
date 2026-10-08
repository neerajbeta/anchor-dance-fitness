"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Code = {
  code: string;
  name: string | null;
  rule: string;
  active: boolean | null;
  validUntil: string | null;
  uses: number;
  paidUses: number;
  customers: number;
  before: number;
  discount: number;
  revenue: number;
  estimated: boolean;
  lastUsed: string | null;
};
type Use = {
  id: string;
  name: string;
  email: string;
  type: string;
  detail: string | null;
  location: string;
  code: string;
  amount: number;
  paid: string;
  status: string;
  createdAt: string;
  discount: number;
  before: number;
  estimated: boolean;
  counted: boolean;
};

const RANGES = [
  { v: "all", l: "All time" },
  { v: "month", l: "This month" },
  { v: "30", l: "Last 30 days" },
  { v: "90", l: "Last 90 days" },
  { v: "year", l: "This year" },
];
const TYPE_ICON: Record<string, string> = { class: "💃", workshop: "🎭", event: "⭐", studio: "🏛️" };
const sek = (n: number) => `SEK ${Math.round(n).toLocaleString("sv-SE")}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

function rangeDates(v: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (v === "month") return { from: `${iso(now).slice(0, 7)}-01` };
  if (v === "year") return { from: `${now.getFullYear()}-01-01` };
  if (v === "30" || v === "90") return { from: iso(new Date(now.getTime() - Number(v) * 86_400_000)) };
  return {};
}

export function CouponsClient() {
  const [range, setRange] = useState("all");
  const [codes, setCodes] = useState<Code[]>([]);
  const [uses, setUses] = useState<Use[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [hideUnused, setHideUnused] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(rangeDates(range) as Record<string, string>);
    fetch(`/api/coupons?${qs}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Couldn't load coupon usage");
        setCodes(j.data.codes);
        setUses(j.data.uses);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load coupon usage"))
      .finally(() => setLoading(false));
  }, [range]);

  const totals = useMemo(
    () =>
      codes.reduce(
        (t, c) => ({ uses: t.uses + c.uses, discount: t.discount + c.discount, revenue: t.revenue + c.revenue, before: t.before + c.before, used: t.used + (c.uses ? 1 : 0) }),
        { uses: 0, discount: 0, revenue: 0, before: 0, used: 0 }
      ),
    [codes]
  );
  const anyEstimated = codes.some((c) => c.estimated);
  const shown = hideUnused ? codes.filter((c) => c.uses > 0) : codes;
  const maxDiscount = Math.max(1, ...codes.map((c) => c.discount));

  return (
    <>
      <SectionHead
        title="Coupon Usage"
        sub="Which discount codes were used, by whom, and what they did to revenue"
        right={
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={shown}
              filename={`Coupon-codes-${range}`}
              sheetName="Codes"
              label="Export codes"
              notes={[`Coupon codes — ${RANGES.find((r) => r.v === range)?.l ?? range} · ${shown.length} codes`]}
              columns={[
                { label: "Code", value: (c) => c.code },
                { label: "Name", value: (c) => c.name ?? "" },
                { label: "Rule", value: (c) => c.rule },
                { label: "Active", value: (c) => (c.active ? "Yes" : "No") },
                { label: "Valid until", value: (c) => c.validUntil?.slice(0, 10) ?? "" },
                { label: "Uses", value: (c) => c.uses },
                { label: "Paid uses", value: (c) => c.paidUses },
                { label: "Customers", value: (c) => c.customers },
                { label: "Price before discount (SEK)", value: (c) => c.before },
                { label: "Discount given (SEK)", value: (c) => c.discount },
                { label: "Revenue (SEK)", value: (c) => c.revenue },
                { label: "Last used", value: (c) => c.lastUsed?.slice(0, 10) ?? "" },
              ]}
            />
            <ExportExcelButton
              rows={uses}
              filename={`Coupon-uses-${range}`}
              sheetName="Uses"
              label="Export uses"
              notes={[`Coupon uses — ${RANGES.find((r) => r.v === range)?.l ?? range} · ${uses.length} bookings`]}
              columns={[
                { label: "Date", value: (u) => u.createdAt.slice(0, 10) },
                { label: "Code", value: (u) => u.code },
                { label: "Customer", value: (u) => u.name },
                { label: "Email", value: (u) => u.email },
                { label: "Booking ID", value: (u) => u.id },
                { label: "Type", value: (u) => u.type },
                { label: "What", value: (u) => u.detail ?? "" },
                { label: "Location", value: (u) => u.location },
                { label: "Price before discount (SEK)", value: (u) => u.before },
                { label: "Discount (SEK)", value: (u) => u.discount },
                { label: "Paid (SEK)", value: (u) => (u.paid === "paid" ? u.amount : 0) },
                { label: "Payment status", value: (u) => u.paid },
                { label: "Status", value: (u) => u.status },
              ]}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="field w-auto text-[13px]" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period">
          {RANGES.map((r) => (
            <option key={r.v} value={r.v}>
              {r.l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-slate">
          <input type="checkbox" checked={hideUnused} onChange={(e) => setHideUnused(e.target.checked)} /> Hide codes not used
        </label>
        {loading && <span className="text-[12px] text-muted">Loading…</span>}
      </div>

      {error && <div className="mb-3 rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile label="Codes used" value={String(totals.used)} sub={`of ${codes.length} in the Discount Master`} />
          <Tile label="Times used" value={String(totals.uses)} sub="Bookings with a code" />
          <Tile label="Discount given" value={sek(totals.discount)} sub={totals.before ? `${Math.round((totals.discount / totals.before) * 100)}% off list price` : "—"} />
          <Tile label="Revenue from coupon bookings" value={sek(totals.revenue)} sub="Paid, incl. VAT" />
          <Tile label="Avg discount per use" value={totals.uses ? sek(totals.discount / totals.uses) : "—"} />
        </div>

        <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="dt">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Uses</th>
                  <th>Customers</th>
                  <th className="min-w-[180px]">Discount given</th>
                  <th>Revenue after discount</th>
                  <th>Last used</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      No discount codes {hideUnused ? "used in this period" : "yet"}.
                    </td>
                  </tr>
                )}
                {shown.map((c) => {
                  const list = uses.filter((u) => u.code === c.code);
                  return (
                    <Fragment key={c.code}>
                      <tr className={c.uses ? "" : "opacity-60"}>
                        <td>
                          <div className="font-mono text-[13px] font-bold text-ink">🏷️ {c.code}</div>
                          <div className="text-[11px] text-muted">
                            {c.name ? `${c.name} · ` : ""}
                            {c.rule}
                            {c.active === false ? " · inactive" : ""}
                            {c.validUntil && c.validUntil < new Date().toISOString().slice(0, 10) ? " · expired" : ""}
                          </div>
                        </td>
                        <td className="text-[13px]">
                          <strong className="text-ink">{c.uses}</strong>
                          {c.uses !== c.paidUses && <div className="text-[10px] text-muted">{c.paidUses} paid</div>}
                        </td>
                        <td className="text-[13px] text-ink">{c.customers}</td>
                        <td>
                          <div className="text-[12px] font-semibold text-ink">
                            {sek(c.discount)}
                            {c.estimated && <span title="Includes estimates for bookings made before discounts were recorded"> *</span>}
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-r bg-[#f3f2ee]">
                            <div className="h-full rounded-r-[4px]" style={{ width: `${(c.discount / maxDiscount) * 100}%`, background: "#2a78d6" }} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-[13px] font-semibold text-ink">{c.revenue ? sek(c.revenue) : "—"}</td>
                        <td className="whitespace-nowrap text-[12px]">{day(c.lastUsed)}</td>
                        <td>
                          {c.uses > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === c.code ? null : c.code)}>
                              {open === c.code ? "Hide" : "Who used it"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {open === c.code && (
                        <tr>
                          <td colSpan={7} className="bg-cream/30">
                            <table className="w-full text-left text-[12px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                              <thead className="text-[10px] uppercase tracking-wide text-muted">
                                <tr>
                                  <th className="py-1.5">Date</th>
                                  <th className="py-1.5">Customer</th>
                                  <th className="py-1.5">Booking</th>
                                  <th className="py-1.5 text-right">List price</th>
                                  <th className="py-1.5 text-right">Discount</th>
                                  <th className="py-1.5 text-right">Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {list.map((u) => (
                                  <tr key={u.id} className="border-t border-line">
                                    <td className="py-1.5">{day(u.createdAt)}</td>
                                    <td className="py-1.5">
                                      <div className="font-semibold text-ink">{u.name}</div>
                                      <div className="text-muted">{u.email}</div>
                                    </td>
                                    <td className="py-1.5">
                                      {TYPE_ICON[u.type] ?? ""} {u.detail} <span className="text-muted">· {u.id}</span>
                                    </td>
                                    <td className="py-1.5 text-right">{sek(u.before)}</td>
                                    <td className="py-1.5 text-right text-ink">
                                      − {sek(u.discount)}
                                      {u.estimated && <span title="Estimated from the code's current rule"> *</span>}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {u.paid === "paid" ? <strong className="text-ink">{sek(u.amount)}</strong> : <span className="text-muted">{u.paid === "onetime" ? "Waived" : "Unpaid"}</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {anyEstimated && (
          <div className="mt-2 text-[11px] text-muted">
            * Bookings made before discounts were recorded on each booking: the discount is estimated from the code&apos;s current rule.
          </div>
        )}
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
