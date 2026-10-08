// One place that answers "did this booking actually get paid?" for both
// gateways. Every booking type's success / pending / cancelled pages rely on
// it, so Stripe and Swish always end the same way. Server only.

import {
  getRegistrationById,
  markRegistrationPaid,
  markRegistrationPaymentCancelled,
  PAYMENT_CANCELLED_STATUS,
  seatTargetOf,
} from "@/lib/services";
import { processWaitlist } from "@/lib/waitlist";
import { sendBookingConfirmation } from "@/lib/email/notify";
import { expireCheckoutSession, retrieveCheckoutSession } from "./stripe";
import { getSwishPaymentStatus } from "./swish";
import type { BookingType } from "./pages";

export type PaymentState = "paid" | "pending" | "failed";

export type PaymentCheck = {
  id: string;
  state: PaymentState;
  method: "stripe" | "swish" | null;
  amount: number;
  /** VAT the booking was sold with — shown on the receipt. */
  vatAmount: number;
  vatRateBp: number;
  vatMode: string | null;
  netAmount: number | null;
  /** Lets a result page send the customer to the right booking type's pages. */
  type: BookingType;
};

export class PaymentNotFoundError extends Error {}

/**
 * Reads the real status from the gateway (never from the browser) and marks
 * the booking paid when it is.
 *
 * With `cancel: true` an unpaid payment is also closed: the Stripe Checkout
 * page is expired so it can't be paid later from browser history, and the
 * booking is marked "Payment Cancelled" (which also frees a held studio slot).
 * A payment that turns out to be paid is never cancelled — it's reported as paid.
 * The first time a booking is seen paid, the customer gets their confirmation email.
 */
export async function checkPayment(id: string, opts: { cancel?: boolean; origin?: string } = {}): Promise<PaymentCheck> {
  const row = await getRegistrationById(id);
  if (!row) throw new PaymentNotFoundError();

  const method = row.paymentMethod === "stripe" || row.paymentMethod === "swish" ? row.paymentMethod : null;
  const result = (state: PaymentState): PaymentCheck => ({
    id: row.id,
    state,
    method,
    amount: row.amount,
    vatAmount: row.vatAmount,
    vatRateBp: row.vatRateBp,
    vatMode: row.vatMode,
    netAmount: row.netAmount,
    type: row.type,
  });
  const failed = async () => {
    if (row.status !== PAYMENT_CANCELLED_STATUS) {
      await markRegistrationPaymentCancelled(row.id);
      // The seat this checkout held is free again — offer it to the waitlist.
      const target = seatTargetOf(row);
      if (target) void processWaitlist(target, { origin: opts.origin });
    }
    return result("failed");
  };

  if (row.paid === "paid") return result("paid");
  if (!method || !row.paymentRef) return failed();

  if (method === "stripe") {
    const session = await retrieveCheckoutSession(row.paymentRef);
    if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      const paid = await markRegistrationPaid(row.id, "stripe", session.id);
      if (paid) void sendBookingConfirmation(paid, opts.origin);
      return result("paid");
    }
    if (session.status === "expired") return failed();
    if (opts.cancel && session.status === "open") {
      await expireCheckoutSession(session.id).catch(() => {});
      return failed();
    }
    return result("pending");
  }

  const swish = await getSwishPaymentStatus(row.paymentRef);
  if (swish.paid) {
    const paid = await markRegistrationPaid(row.id, "swish", row.paymentRef);
    if (paid) void sendBookingConfirmation(paid, opts.origin);
    return result("paid");
  }
  if (swish.failed || opts.cancel) return failed();
  return result("pending");
}
