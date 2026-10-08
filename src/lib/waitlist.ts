// Hands freed seats to the waitlist and emails whoever's next. Server only.
//
// There's no background job, so this runs whenever a seat may have freed up:
// a payment is cancelled, an admin raises capacity, the Capacity page or a
// booking page is opened (catches abandoned checkouts and expired offers), or
// an admin presses "Notify next".

import {
  allocateWaitlistSeats,
  describeSeatTarget,
  WAITLIST_OFFER_HOURS,
  type SeatTarget,
} from "@/lib/services";
import { sendWaitlistSeatEmail } from "@/lib/email/notify";

let lastSweep = 0;
const SWEEP_EVERY_MS = 60 * 1000;

/** Offers free seats (for one class/event, or all of them) and emails each person offered one. */
export async function processWaitlist(target?: SeatTarget, opts: { force?: boolean; origin?: string | null } = {}) {
  try {
    const offers = await allocateWaitlistSeats(target, { force: opts.force });
    for (const o of offers) {
      const info = await describeSeatTarget(o);
      if (info) await sendWaitlistSeatEmail(o, info, WAITLIST_OFFER_HOURS, opts.origin);
    }
    return offers;
  } catch (err) {
    console.error("[waitlist] processing failed:", err);
    return [];
  }
}

/** Full sweep at most once a minute — cheap enough to call from page loads. */
export function sweepWaitlistsSoon(origin?: string | null) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  void processWaitlist(undefined, { origin });
}
