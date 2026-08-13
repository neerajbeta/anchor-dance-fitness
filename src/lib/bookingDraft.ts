// Client-side bridge that carries a booking selection between pages
// (Book Class → Plans/Pay → Confirmation) since there's no server session for
// students yet. sessionStorage only — cleared when the tab closes.

export type BookingDraft = {
  type: "class" | "studio";
  // shared
  location: string;
  flag?: string;
  mode: "online" | "offline";
  period: string; // display string, e.g. "2025-08-04 – 2025-10-31"
  detail: string; // e.g. "Morning Bollywood · 10:00–12:00"
  category?: string;
  level?: string;
  classId?: string;
  baseAmount: number; // SEK before discount, used for the plan/pay screen
  planName?: string;
};

export type LastBooking = {
  id: string;
  name: string;
  email: string;
  type: "class" | "studio";
  location: string;
  detail: string;
  category?: string;
  period: string;
  plan: string;
  mode?: "online" | "offline";
  amount: number;
  baseAmount: number;
  discountCode?: string | null;
};

const DRAFT_KEY = "af_booking_draft";
const LAST_KEY = "af_last_booking";

export function saveDraft(draft: BookingDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
}

export function saveLastBooking(b: LastBooking) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_KEY, JSON.stringify(b));
}

export function loadLastBooking(): LastBooking | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(LAST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastBooking;
  } catch {
    return null;
  }
}
