/**
 * Customer lifecycle shared by the admin Customers page and the server.
 * Safe to import on the client (no server code).
 */

export type CustomerStatus = "active" | "paused" | "dropped";
export type CustomerAction = "paused" | "dropped" | "resumed" | "blacklisted" | "unblacklisted";

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "Active",
  paused: "Paused",
  dropped: "Dropped off",
};

/** Short reason codes for a pause / drop-off, grouped so patterns show up in reports. */
export const DROP_REASONS: { code: string; label: string }[] = [
  { code: "pricing", label: "💰 Pricing / too expensive" },
  { code: "timing", label: "🕒 Class timing doesn't suit" },
  { code: "instructor", label: "🧑‍🏫 Instructor" },
  { code: "location", label: "📍 Location / travel" },
  { code: "relocated", label: "✈️ Moved away" },
  { code: "health", label: "🩹 Health / injury" },
  { code: "busy", label: "📚 Busy — work / studies" },
  { code: "travel", label: "🧳 Travelling / holiday" },
  { code: "level", label: "🎚️ Level not right" },
  { code: "not_interested", label: "🙅 Lost interest" },
  { code: "other", label: "✏️ Other" },
];

/** Why a customer was blacklisted. */
export const BLACKLIST_REASONS: { code: string; label: string }[] = [
  { code: "non_payment", label: "💸 Repeated non-payment" },
  { code: "behaviour", label: "⚠️ Behaviour / conduct" },
  { code: "fraud", label: "🚫 Payment dispute / fraud" },
  { code: "other", label: "✏️ Other" },
];

const ALL_REASONS = [...DROP_REASONS, ...BLACKLIST_REASONS];

export function reasonLabel(code: string | null | undefined) {
  if (!code) return "";
  return ALL_REASONS.find((r) => r.code === code)?.label ?? code;
}

export function isCustomerStatus(v: unknown): v is CustomerStatus {
  return v === "active" || v === "paused" || v === "dropped";
}

export const ACTION_LABEL: Record<CustomerAction, string> = {
  paused: "⏸️ Paused",
  dropped: "📉 Marked as dropped off",
  resumed: "▶️ Resumed",
  blacklisted: "⛔ Blacklisted",
  unblacklisted: "✅ Removed from blacklist",
};
