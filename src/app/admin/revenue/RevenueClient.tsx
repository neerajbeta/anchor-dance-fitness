"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type TypeKey ="class" | "workshop" | "event" | "studio";
type Slice = { key: string; label: string; revenue: number; net: number; vat: number; discount: number; bookings: number };
type Report = {
  month: string;
  months: string[];
  trend: { month: string; total: number; net: number; vat: number; bookings: number; byType: Record<TypeKey, number> }[];
  kpis: { revenue: number; net: number; vat: number; bookings: number; average: number; previous: number; discount: number; yearToDate: number };
  byType: Slice[];
  byClass: Slice[];
  byCategory: Slice[];
  byLocation: Slice[];
  byMethod: Slice[];
};

// Categorical slots 1–4 of the validated palette, fixed order (stack bottom → top).
const SERIES: { key: TypeKey; label: string; color: string }[] = [
  { key: "class", label: "Classes", color: "#2a78d6" },
  { key: "workshop", label: "Workshops", color: "#eb6834" },
  { key: "event", label: "Events", color: "#1baf7a" },
  { key: "studio", label: "Studio hire", color: "#eda100" },
];
const INK = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#ffffff" };

const sek = (n: number) => `SEK ${Math.round(n).toLocaleString("sv-SE")}`;
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("sv-SE"));
const monthLabel = (m: string, long = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", long ? { month: "long", year: "numeric" } : { month: "short" });

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p;
  return 10 * p;
}

export function RevenueClient() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [location, setLocation] = useState("");
  const [locs, setLocs] = useState<{ id: string; label: string; flag: string | null }[]>([]);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocs(j.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ month, ...(location ? { location } : {}) });
    fetch(`/api/revenue?${qs}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Couldn't load revenue");
        setData(j.data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load revenue"))
      .finally(() => setLoading(false));
  }, [month, location]);

  // Month picker: the last 24 months.
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1)).toISOString().slice(0, 7));
  }, []);

  const k = data?.kpis;
  const delta = k && k.previous > 0 ? Math.round(((k.revenue - k.previous) / k.previous) * 100) : null;

  // One flat sheet: every month of the trend, then this month's breakdowns.
  const exportRows = useMemo(() => {
    if (!data) return [];
    type Row = { section: string; label: string; revenue: number; net: number; vat: number; discount: number | ""; bookings: number };
    const rows: Row[] = data.trend.map((t) => ({
      section: "Monthly trend",
      label: t.month,
      revenue: t.total,
      net: t.net,
      vat: t.vat,
      discount: "",
      bookings: t.bookings,
    }));
    const add = (section: string, slices: Slice[]) => {
      for (const s of slices)
        rows.push({ section, label: s.label, revenue: s.revenue, net: s.net, vat: s.vat, discount: s.discount, bookings: s.bookings });
    };
    add(`By type · ${data.month}`, data.byType);
    add(`By class / batch · ${data.month}`, data.byClass);
    add(`By category · ${data.month}`, data.byCategory);
    add(`By location · ${data.month}`, data.byLocation);
    add(`By payment method · ${data.month}`, data.byMethod);
    return rows;
  }, [data]);

  return (
    <>
      <SectionHead
        title="Revenue"
        sub="Paid revenue by month, broken down by class / batch, class type and location"
        right={
          <ExportExcelButton
            rows={exportRows}
            filename={`Revenue-${data?.month ?? ""}`}
            sheetName="Revenue"
            notes={[
              `Revenue — ${data?.month ?? ""}${location ? ` · ${location}` : ""}`,
              data ? `Month total ${sek(data.kpis.revenue)} · ${data.kpis.bookings} bookings · year to date ${sek(data.kpis.yearToDate)}` : "",
            ].filter(Boolean)}
            columns={[
              { label: "Section", value: (r) => r.section },
              { label: "Item", value: (r) => r.label },
              { label: "Revenue (SEK)", value: (r) => r.revenue },
              { label: "Net excl. VAT (SEK)", value: (r) => r.net },
              { label: "VAT (SEK)", value: (r) => r.vat },
              { label: "Discount (SEK)", value: (r) => r.discount },
              { label: "Bookings", value: (r) => r.bookings },
            ]}
          />
        }
      />

      {/* Filters — one row, above everything they scope */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="field w-auto text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, true)}
            </option>
          ))}
        </select>
        <select className="field w-auto text-[13px]" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {locs.map((l) => (
            <option key={l.id} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        {loading && data && <span className="text-[12px] text-muted">Updating…</span>}
      </div>

      {error && <div className="mb-3 rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

      <div className={`transition-opacity ${loading && data ? "opacity-60" : ""}`}>
        {/* KPI row */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="stat col-span-2 lg:col-span-1">
            <div className="stat-label">Revenue · {data ? monthLabel(data.month, true) : "—"}</div>
            <div className="text-[34px] font-bold leading-tight text-ink">{k ? sek(k.revenue) : "—"}</div>
            <div className="stat-sub">
              {delta == null ? (
                "No revenue last month to compare"
              ) : (
                <span className={delta >= 0 ? "font-semibold text-[#006300]" : "font-semibold text-danger"}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs {data ? monthLabel(data.months[10]) : "last month"}
                </span>
              )}
            </div>
          </div>
          <Tile label="Net (excl. VAT)" value={k ? sek(k.net) : "—"} sub={k ? `VAT collected ${sek(k.vat)}` : ""} />
          <Tile label="Paid bookings" value={k ? String(k.bookings) : "—"} sub={k ? `Average ${sek(k.average)}` : ""} />
          <Tile label="Discounts given" value={k ? sek(k.discount) : "—"} sub="Recorded on bookings made since coupon tracking" />
          <Tile label={`Year to date · ${data?.month.slice(0, 4) ?? ""}`} value={k ? sek(k.yearToDate) : "—"} sub="Jan → selected month" />
        </div>

        {/* Trend */}
        <div className="mb-4 rounded-xl border border-line/70 bg-white p-4 shadow-card">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-display text-[15px] font-bold text-ink">Monthly revenue by booking type</div>
              <div className="text-[12px] text-muted">12 months · click a month to see its breakdown</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
              {showTable ? "📊 Chart" : "🗒️ Table"}
            </button>
          </div>
          <Legend />
          {data ? (
            showTable ? (
              <TrendTable data={data} />
            ) : (
              <TrendChart data={data} selected={data.month} onSelect={setMonth} />
            )
          ) : (
            <div className="py-20 text-center text-[13px] text-muted">{loading ? "Loading…" : "No data"}</div>
          )}
        </div>

        {/* Breakdowns for the selected month */}
        <div className="grid gap-4 xl:grid-cols-2">
          <Breakdown title="By class / batch" sub="Which classes and events earn the most" rows={data?.byClass ?? []} total={k?.revenue ?? 0} />
          <Breakdown title="By class type" sub="Class category (workshops, events and studio as their own rows)" rows={data?.byCategory ?? []} total={k?.revenue ?? 0} />
          <Breakdown title="By location" rows={data?.byLocation ?? []} total={k?.revenue ?? 0} />
          <Breakdown title="By payment method" rows={data?.byMethod ?? []} total={k?.revenue ?? 0} />
        </div>
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

function Legend() {
  return (
    <div className="mb-2 mt-2 flex flex-wrap gap-4 text-[12px]" style={{ color: INK.secondary }}>
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function TrendChart({ data, selected, onSelect }: { data: Report; selected: string; onSelect: (m: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 260;
  const pad = { l: 52, r: 8, t: 14, b: 28 };
  const plotW = width - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = niceMax(Math.max(...data.trend.map((t) => t.total)));
  const band = plotW / data.trend.length;
  const barW = Math.min(24, band * 0.55);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const GAP = 2;

  const hovered = hover != null ? data.trend[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(pad.l + band * hover + band / 2, 110), width - 110) : 0;

  return (
    <div ref={wrap} className="relative">
      <svg width={width} height={H} role="img" aria-label="Monthly revenue by booking type, last 12 months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
              {compact(t)}
            </text>
          </g>
        ))}
        {data.trend.map((t, i) => {
          const cx = pad.l + band * i + band / 2;
          const x = cx - barW / 2;
          let acc = 0;
          const segs = SERIES.map((s) => ({ s, v: t.byType[s.key] })).filter((p) => p.v > 0);
          const isSel = t.month === selected;
          return (
            <g
              key={t.month}
              tabIndex={0}
              role="button"
              aria-label={`${monthLabel(t.month, true)}: ${sek(t.total)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(t.month)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(t.month)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {/* hit target: the whole band */}
              <rect x={pad.l + band * i} y={pad.t} width={band} height={plotH} fill={hover === i ? "rgba(11,11,11,0.035)" : "transparent"} />
              {segs.map(({ s, v }, si) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const top = si === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (top ? 0 : GAP));
                const yTop = y0 - h - (si === 0 ? 0 : 0);
                if (h <= 0) return null;
                const r = top ? Math.min(4, h, barW / 2) : 0;
                // square at the bottom, 4px rounded at the data end
                const d = `M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z`;
                return <path key={s.key} d={d} fill={s.color} opacity={hover === i || hover == null ? 1 : 0.55} />;
              })}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fontWeight={isSel ? 700 : 400}
                fill={isSel ? INK.primary : INK.muted}
              >
                {monthLabel(t.month)}
              </text>
              {isSel && <line x1={cx - 10} x2={cx + 10} y1={H - 2} y2={H - 2} stroke={INK.primary} strokeWidth={2} strokeLinecap="round" />}
            </g>
          );
        })}
        {/* Direct label on the selected month only */}
        {(() => {
          const i = data.trend.findIndex((t) => t.month === selected);
          const t = data.trend[i];
          if (!t || !t.total) return null;
          return (
            <text x={pad.l + band * i + band / 2} y={y(t.total) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK.primary}>
              {compact(t.total)}
            </text>
          );
        })()}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[190px] -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-pop"
          style={{ left: tipLeft }}
        >
          <div className="mb-1 font-semibold" style={{ color: INK.secondary }}>
            {monthLabel(hovered.month, true)}
          </div>
          <div className="mb-1.5 text-[15px] font-bold" style={{ color: INK.primary }}>
            {sek(hovered.total)}
          </div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5" style={{ color: INK.secondary }}>
                <span className="inline-block h-[2px] w-3 rounded" style={{ background: s.color }} />
                {s.label}
              </span>
              <strong style={{ color: INK.primary, fontVariantNumeric: "tabular-nums" }}>{sek(hovered.byType[s.key])}</strong>
            </div>
          ))}
          <div className="mt-1.5 border-t border-line pt-1.5" style={{ color: INK.muted }}>
            {hovered.bookings} paid booking{hovered.bookings === 1 ? "" : "s"} · VAT {sek(hovered.vat)}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendTable({ data }: { data: Report }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead className="text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2">Month</th>
            {SERIES.map((s) => (
              <th key={s.key} className="py-2 text-right">
                {s.label}
              </th>
            ))}
            <th className="py-2 text-right">Total</th>
            <th className="py-2 text-right">Net</th>
            <th className="py-2 text-right">VAT</th>
            <th className="py-2 text-right">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {data.trend.map((t) => (
            <tr key={t.month} className={`border-t border-line ${t.month === data.month ? "font-bold text-ink" : "text-slate"}`}>
              <td className="py-1.5">{monthLabel(t.month, true)}</td>
              {SERIES.map((s) => (
                <td key={s.key} className="py-1.5 text-right">
                  {t.byType[s.key] ? sek(t.byType[s.key]) : "—"}
                </td>
              ))}
              <td className="py-1.5 text-right text-ink">{sek(t.total)}</td>
              <td className="py-1.5 text-right">{sek(t.net)}</td>
              <td className="py-1.5 text-right">{sek(t.vat)}</td>
              <td className="py-1.5 text-right">{t.bookings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single-series ranked bars: value at the tip, share beside it. */
function Breakdown({ title, sub, rows, total }: { title: string; sub?: string; rows: Slice[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, 8);
  return (
    <div className="rounded-xl border border-line/70 bg-white p-4 shadow-card">
      <div className="font-display text-[15px] font-bold text-ink">{title}</div>
      {sub && <div className="mb-2 text-[12px] text-muted">{sub}</div>}
      {rows.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-muted">No paid bookings this month.</div>
      ) : (
        <div className="mt-2 flex flex-col gap-2.5">
          {shown.map((r) => (
            <div
              key={r.key}
              title={`${r.label}: ${sek(r.revenue)} · net ${sek(r.net)} · VAT ${sek(r.vat)}${r.discount ? ` · discounts ${sek(r.discount)}` : ""} · ${r.bookings} booking${r.bookings === 1 ? "" : "s"}`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 truncate font-semibold" style={{ color: INK.primary }}>
                  {r.label}
                </span>
                <span className="shrink-0" style={{ color: INK.secondary, fontVariantNumeric: "tabular-nums" }}>
                  <strong style={{ color: INK.primary }}>{sek(r.revenue)}</strong> · {total ? Math.round((r.revenue / total) * 100) : 0}% · {r.bookings}×
                </span>
              </div>
              <div className="h-2 w-full rounded-r bg-[#f3f2ee]">
                <div className="h-full rounded-r-[4px]" style={{ width: `${(r.revenue / max) * 100}%`, background: SERIES[0].color }} />
              </div>
            </div>
          ))}
          {rows.length > 8 && (
            <button className="self-start text-[12px] font-semibold text-brand-600" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show top 8" : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
