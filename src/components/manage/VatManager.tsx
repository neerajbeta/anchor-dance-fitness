"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";
import {
  applyVat,
  formatVatRate,
  VAT_BOOKING_TYPES,
  VAT_PRESETS,
  vatRuleFor,
  type VatMode,
  type VatRule,
} from "@/lib/vat";

type SavedRule = VatRule & { updatedBy: string | null; updatedAt: string | null };
type Draft = { bookingType: VatRule["bookingType"]; rate: string; mode: VatMode; active: boolean };

const EXAMPLE_PRICE = 1000;
const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;

function toDraft(r: VatRule): Draft {
  return { bookingType: r.bookingType, rate: String(r.rateBp / 100), mode: r.mode, active: r.active };
}

/** "25", "6.5" → basis points; null when not a valid 0–100 rate with ≤ 2 decimals. */
function parseRate(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return n >= 0 && n <= 10000 ? n : null;
}

/**
 * Admin → VAT Master: the VAT rate and Inclusive/Exclusive setting for each
 * booking type. Applied by the server when a booking is priced; every booking
 * keeps the VAT it was sold with.
 */
export function VatManager() {
  const { can } = usePermissions();
  const editable = can("settings.edit");

  const [saved, setSaved] = useState<SavedRule[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load(rules: SavedRule[]) {
    setSaved(rules);
    setDrafts(rules.map(toDraft));
  }

  useEffect(() => {
    fetch("/api/vat")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Couldn't load VAT settings");
        load(j.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const dirty = useMemo(
    () => Boolean(saved && JSON.stringify(saved.map(toDraft)) !== JSON.stringify(drafts)),
    [saved, drafts]
  );
  const invalid = drafts.some((d) => parseRate(d.rate) === null);

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
    setNotice(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const rules = drafts.map((d) => ({
        bookingType: d.bookingType,
        rateBp: parseRate(d.rate),
        mode: d.mode,
        active: d.active,
      }));
      const res = await fetch("/api/vat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      load(j.data);
      setNotice("✓ VAT saved — new bookings use these rates. Existing bookings keep the VAT they were sold with.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  if (!saved) {
    return <div className="card text-[13px] text-muted">{error ? `⚠️ ${error}` : "Loading…"}</div>;
  }

  const lastEdit = saved
    .filter((r) => r.updatedAt)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ModeExplainer
          mode="inclusive"
          title="Inclusive"
          text="The price you set already contains VAT. The customer pays the listed price; the VAT inside it is shown on the receipt."
        />
        <ModeExplainer
          mode="exclusive"
          title="Exclusive"
          text="VAT is added on top of the price you set. The customer pays the price + VAT, shown before they pay."
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Booking type</th>
              <th className="px-4 py-3">VAT rate</th>
              <th className="px-4 py-3">Price is</th>
              <th className="px-4 py-3">Apply</th>
              <th className="px-4 py-3">Example on {sek(EXAMPLE_PRICE)}</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => {
              const meta = VAT_BOOKING_TYPES.find((t) => t.type === d.bookingType)!;
              const rateBp = parseRate(d.rate);
              const rule = vatRuleFor(
                rateBp === null ? null : [{ bookingType: d.bookingType, rateBp, mode: d.mode, active: d.active }],
                d.bookingType
              );
              const ex = applyVat(EXAMPLE_PRICE, rule);
              return (
                <tr key={d.bookingType} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cream-deep text-lg">{meta.icon}</span>
                      <div className="font-bold text-ink">{meta.label}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <input
                        className={`field w-20 text-right ${rateBp === null ? "border-danger" : ""}`}
                        inputMode="decimal"
                        value={d.rate}
                        disabled={!editable}
                        onChange={(e) => update(i, { rate: e.target.value })}
                        aria-label={`${meta.label} VAT rate`}
                      />
                      <span className="font-bold text-slate">%</span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      {VAT_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={!editable}
                          onClick={() => update(i, { rate: String(p) })}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
                            rateBp === p * 100
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-line text-muted hover:border-brand-300"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="inline-flex rounded-lg border border-line p-0.5">
                      {(["inclusive", "exclusive"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={!editable}
                          onClick={() => update(i, { mode: m })}
                          className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition ${
                            d.mode === m ? "bg-ink text-white" : "text-muted hover:text-ink"
                          }`}
                        >
                          {m === "inclusive" ? "Incl. VAT" : "Excl. VAT"}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-500"
                        checked={d.active}
                        disabled={!editable}
                        onChange={(e) => update(i, { active: e.target.checked })}
                      />
                      {d.active ? "On" : "Off"}
                    </label>
                  </td>
                  <td className="px-4 py-4">
                    {rateBp === null ? (
                      <span className="text-[12px] font-semibold text-danger">Enter a rate, e.g. 25</span>
                    ) : !rule ? (
                      <div className="text-[12px] text-muted">
                        No VAT · customer pays <strong className="text-ink">{sek(ex.total)}</strong>
                      </div>
                    ) : (
                      <div className="text-[12px] leading-relaxed">
                        <div className="text-muted">
                          Net <span className="font-semibold text-ink">{sek(ex.net)}</span> + VAT{" "}
                          {formatVatRate(ex.rateBp)} <span className="font-semibold text-ink">{sek(ex.vat)}</span>
                        </div>
                        <div>
                          Customer pays <strong className="text-brand-600">{sek(ex.total)}</strong>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <div className="text-[12px] font-semibold text-danger">⚠️ {error}</div> : null}
      {notice ? <div className="text-[12px] font-semibold text-ok">{notice}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        {editable ? (
          <>
            <button
              type="button"
              className={`btn btn-primary ${busy || !dirty || invalid ? "is-disabled" : ""}`}
              disabled={busy || !dirty || invalid}
              onClick={save}
            >
              {busy ? "Saving…" : "Save VAT settings"}
            </button>
            {dirty ? (
              <button type="button" className="btn btn-ghost" onClick={() => setDrafts(saved.map(toDraft))}>
                Discard changes
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-[12px] text-muted">You can view VAT settings but not change them.</span>
        )}
        {lastEdit?.updatedAt ? (
          <span className="ml-auto text-[11px] text-muted">
            Last changed{" "}
            {new Date(lastEdit.updatedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {lastEdit.updatedBy ? ` by ${lastEdit.updatedBy}` : ""}
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-muted">
        VAT is calculated on the price after any discount code and rounded to whole kronor. Each booking stores the rate,
        net amount and VAT it was sold with, so changing a rate here never alters existing receipts.
      </p>
    </div>
  );
}

function ModeExplainer({ mode, title, text }: { mode: VatMode; title: string; text: string }) {
  const ex = applyVat(EXAMPLE_PRICE, { bookingType: "class", rateBp: 2500, mode, active: true });
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className={`badge ${mode === "inclusive" ? "badge-info" : "badge-grape"}`}>{title}</span>
      </div>
      <p className="text-[12px] text-slate">{text}</p>
      <div className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-[12px] text-muted">
        e.g. price {sek(EXAMPLE_PRICE)} at 25% → net {sek(ex.net)} + VAT {sek(ex.vat)} ={" "}
        <strong className="text-ink">customer pays {sek(ex.total)}</strong>
      </div>
    </div>
  );
}
