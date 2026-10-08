/**
 * VAT master: one rule per booking type. Shared by the server (which decides
 * what the customer is charged) and the booking pages (which show the same
 * breakdown before payment). Safe to import on the client.
 *
 *  inclusive — the listed price already contains VAT; the customer pays the
 *              listed price and the VAT inside it is shown on the receipt.
 *  exclusive — VAT is added on top of the listed price at checkout.
 *
 * VAT is worked out on the price after any discount. Amounts are whole SEK, so
 * VAT is rounded to the nearest krona.
 */

export type VatBookingType = "class" | "workshop" | "event" | "studio";
export type VatMode = "inclusive" | "exclusive";

export type VatRule = {
  bookingType: VatBookingType;
  /** Basis points: 2500 = 25%. */
  rateBp: number;
  mode: VatMode;
  active: boolean;
};

export const VAT_BOOKING_TYPES: { type: VatBookingType; label: string; icon: string }[] = [
  { type: "class", label: "Classes & Plans", icon: "💃" },
  { type: "workshop", label: "Workshops", icon: "🎭" },
  { type: "event", label: "Events", icon: "⭐" },
  { type: "studio", label: "Studio Hire", icon: "🏛️" },
];

/** Swedish VAT rates, offered as one-click presets in the admin. */
export const VAT_PRESETS = [0, 6, 12, 25];

/** Until an admin sets a rate, no VAT is applied (prices behave exactly as before). */
export const DEFAULT_VAT_RULES: VatRule[] = VAT_BOOKING_TYPES.map(({ type }) => ({
  bookingType: type,
  rateBp: 0,
  mode: "inclusive",
  active: true,
}));

export type VatBreakdown = {
  /** Price before VAT. */
  net: number;
  vat: number;
  /** What the customer pays. */
  total: number;
  rateBp: number;
  /** null when no VAT applies. */
  mode: VatMode | null;
};

export function vatRuleFor(rules: VatRule[] | null | undefined, type: string): VatRule | null {
  const rule = (rules ?? DEFAULT_VAT_RULES).find((r) => r.bookingType === type);
  return rule && rule.active && rule.rateBp > 0 ? rule : null;
}

/** Splits (inclusive) or adds (exclusive) VAT on a price that's already discounted. */
export function applyVat(price: number, rule: VatRule | null): VatBreakdown {
  const amount = Math.max(0, Math.round(price));
  if (!rule || amount === 0) return { net: amount, vat: 0, total: amount, rateBp: 0, mode: null };
  const rate = rule.rateBp / 10000;
  if (rule.mode === "exclusive") {
    const vat = Math.round(amount * rate);
    return { net: amount, vat, total: amount + vat, rateBp: rule.rateBp, mode: "exclusive" };
  }
  const vat = Math.round((amount * rate) / (1 + rate));
  return { net: amount - vat, vat, total: amount, rateBp: rule.rateBp, mode: "inclusive" };
}

/** "25%", "6%", "12.5%". */
export function formatVatRate(rateBp: number): string {
  return `${Number((rateBp / 100).toFixed(2))}%`;
}

/** Short label for a price, e.g. "incl. 25% VAT" / "+ 25% VAT" / "". */
export function vatPriceNote(rule: VatRule | null): string {
  if (!rule) return "";
  return rule.mode === "exclusive" ? `+ ${formatVatRate(rule.rateBp)} VAT` : `incl. ${formatVatRate(rule.rateBp)} VAT`;
}
