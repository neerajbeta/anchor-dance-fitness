"use client";

import { useVatRules } from "@/lib/useVatRules";
import { applyVat, formatVatRate, vatPriceNote, vatRuleFor, type VatBreakdown } from "@/lib/vat";

/** The active VAT rule for a booking type (null = no VAT), from the admin VAT master. */
export function useVatRule(type: string | null | undefined) {
  return vatRuleFor(useVatRules(), type ?? "class");
}

/** Price with VAT applied the same way the server charges it. */
export function useVatPrice(type: string | null | undefined, price: number): VatBreakdown {
  return applyVat(price, useVatRule(type));
}

/** Small "incl. 25% VAT" / "+ 25% VAT" note next to a listed price; nothing when no VAT applies. */
export function VatTag({ type, className = "" }: { type: string | null | undefined; className?: string }) {
  const note = vatPriceNote(useVatRule(type));
  if (!note) return null;
  return <span className={`text-[10px] font-semibold opacity-80 ${className}`}>{note}</span>;
}

/** "incl. VAT 25% · SEK 113" for a saved booking/receipt; nothing when it had no VAT. */
export function SavedVatLine({
  rateBp,
  vatAmount,
  mode,
  className = "",
}: {
  rateBp?: number | null;
  vatAmount?: number | null;
  mode?: string | null;
  className?: string;
}) {
  if (!mode || !vatAmount) return null;
  return (
    <span className={`text-[11px] text-copy-dim ${className}`}>
      incl. VAT {formatVatRate(rateBp ?? 0)} · SEK {vatAmount.toLocaleString()}
    </span>
  );
}
