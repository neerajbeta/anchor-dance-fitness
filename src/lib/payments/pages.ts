// Where each kind of booking lands after a payment. Shared by the server
// (Stripe return URLs) and the browser (Swish flow), so both always agree.
//
//   Class              → /book/class/payment/{success|pending|cancelled}
//   Workshop / Event   → /book/workshops/payment/{…}
//   Studio Hire        → /book/studio/payment/{…}

export type BookingType = "class" | "workshop" | "event" | "studio";
export type BookingKind = "class" | "workshop" | "studio";
export type PaymentStage = "success" | "pending" | "cancelled";

/** Workshops and events share one set of pages. */
export function bookingKind(type: BookingType | string | null | undefined): BookingKind {
  if (type === "studio") return "studio";
  if (type === "workshop" || type === "event") return "workshop";
  return "class";
}

/** Where each booking flow starts — used for "Book again" / "Try again" links. */
export const BOOKING_START: Record<BookingKind, string> = {
  class: "/book/class",
  workshop: "/book/workshops",
  studio: "/book/studio",
};

export function paymentPageUrl(type: BookingType | string | null | undefined, stage: PaymentStage, ref: string) {
  return `${BOOKING_START[bookingKind(type)]}/payment/${stage}?ref=${encodeURIComponent(ref)}`;
}
