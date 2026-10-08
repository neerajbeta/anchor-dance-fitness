"use client";

import { useState } from "react";
import { FEES } from "@/lib/site/content";

const sek = (n: number) => `${n.toLocaleString("sv-SE")} SEK`;

/** Fee structure with one tab per dance style. */
export function FeeTabs() {
  const [active, setActive] = useState(FEES[0].id);
  const table = FEES.find((f) => f.id === active) ?? FEES[0];

  return (
    <div>
      <div role="tablist" aria-label="Dance style" className="mb-6 flex flex-wrap justify-center gap-2">
        {FEES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={f.id === active}
            onClick={() => setActive(f.id)}
            className={`rounded-full px-5 py-2 text-[14px] font-bold transition ${
              f.id === active ? "bg-gradient-to-r from-[#ea3835] to-[#f89b46] text-white shadow-[0_6px_18px_rgba(234,56,53,0.3)]" : "bg-white text-[#4a4a4a] ring-1 ring-black/10 hover:ring-[#ea3835]/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="overflow-x-auto rounded-[22px] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.07)]">
        <table className="w-full min-w-[560px] text-left text-[14px]" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="border-b border-black/10 text-[12px] uppercase tracking-wide text-[#777]">
              <th className="px-5 py-4">Plan type</th>
              {table.showAge && <th className="px-5 py-4">Age group</th>}
              <th className="px-5 py-4 text-right">Monthly</th>
              <th className="bg-[#ea3835]/[0.06] px-5 py-4 text-right">
                Quarterly
                <span className="ml-1.5 rounded-full bg-gradient-to-r from-[#ea3835] to-[#f89b46] px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-white">Best value</span>
              </th>
              <th className="px-5 py-4 text-right">Half yearly</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-b border-black/5 last:border-0">
                <td className="px-5 py-4">
                  <div className="font-bold text-[#1a1a1a]">{r.mode}</div>
                  <div className="text-[12px] text-[#777]">{r.frequency}</div>
                </td>
                {table.showAge && <td className="px-5 py-4 text-[#4a4a4a]">{r.age}</td>}
                <td className="px-5 py-4 text-right font-semibold text-[#1a1a1a]">{sek(r.monthly)}</td>
                <td className="bg-[#ea3835]/[0.06] px-5 py-4 text-right font-bold text-[#c7302d]">{sek(r.quarterly)}</td>
                <td className="px-5 py-4 text-right font-semibold text-[#1a1a1a]">{sek(r.halfYearly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
