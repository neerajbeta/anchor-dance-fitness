"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clearDraft, loadLastBooking, type LastBooking } from "@/lib/bookingDraft";
import { bookingKind, paymentPageUrl, type BookingKind, type PaymentStage } from "@/lib/payments/pages";

type Check = {
  id: string;
  state: "paid" | "pending" | "failed";
  method: "stripe" | "swish" | null;
  amount: number;
  vatAmount?: number;
  vatRateBp?: number;
  vatMode?: string | null;
  netAmount?: number | null;
  type: string;
};

export type PaymentResult = {
  ref: string;
  /** "checking" until the first answer; "stalled" = still unpaid after the pending page stopped waiting. */
  status: "checking" | "paid" | "pending" | "stalled" | "cancelled" | "error";
  check: Check | null;
  /** The receipt saved at checkout — only when it belongs to this booking. */
  booking: LastBooking | null;
  error: string | null;
};

// How long each page keeps asking before moving on.
const SUCCESS_POLL = { everyMs: 2000, tries: 10 }; // ~20s, then → pending page
const PENDING_POLL = { everyMs: 5000, tries: 180 }; // ~15 min, then "still processing"

/**
 * Drives one payment result page. The URL only carries the booking reference;
 * the real state always comes from the server, which asks Stripe/Swish. If the
 * payment has moved on (e.g. paid while on the pending page) or the reference
 * belongs to a different booking type, the customer is sent to the right page.
 */
export function usePaymentResult(kind: BookingKind, stage: PaymentStage): PaymentResult {
  const router = useRouter();
  const ref = useSearchParams().get("ref") ?? "";
  const [result, setResult] = useState<PaymentResult>({
    ref,
    status: "checking",
    check: null,
    booking: null,
    error: null,
  });

  useEffect(() => {
    if (!ref) {
      setResult((r) => ({ ...r, status: "error", error: "This link is missing its booking reference." }));
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = (to: PaymentStage, type: string) => {
      stopped = true;
      router.replace(paymentPageUrl(type, to, ref));
    };

    const ask = async (attempt: number) => {
      try {
        const res = await fetch(
          stage === "cancelled" ? "/api/payments/verify" : `/api/payments/verify?id=${encodeURIComponent(ref)}`,
          stage === "cancelled"
            ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ref }) }
            : { cache: "no-store" }
        );
        const j = await res.json().catch(() => ({}));
        if (stopped) return;
        if (!res.ok) throw new Error(j.error || "We couldn't check this payment.");
        const check = j.data as Check;

        // A reference for another kind of booking → that booking's own page.
        if (bookingKind(check.type) !== kind) return go(stage, check.type);

        if (check.state === "paid") {
          if (stage !== "success") return go("success", check.type);
          const last = loadLastBooking();
          clearDraft();
          setResult({ ref, status: "paid", check, booking: last?.id === ref ? last : null, error: null });
          return;
        }
        if (check.state === "failed" || stage === "cancelled") {
          if (stage !== "cancelled") return go("cancelled", check.type);
          setResult({ ref, status: "cancelled", check, booking: null, error: null });
          return;
        }

        // Still pending.
        if (stage === "success") {
          if (attempt + 1 >= SUCCESS_POLL.tries) return go("pending", check.type);
          timer = setTimeout(() => ask(attempt + 1), SUCCESS_POLL.everyMs);
          return;
        }
        const stalled = attempt + 1 >= PENDING_POLL.tries;
        setResult({ ref, status: stalled ? "stalled" : "pending", check, booking: null, error: null });
        if (!stalled) timer = setTimeout(() => ask(attempt + 1), PENDING_POLL.everyMs);
      } catch (err) {
        if (stopped) return;
        if (attempt < 3) {
          timer = setTimeout(() => ask(attempt + 1), 2000);
          return;
        }
        setResult((r) => ({
          ...r,
          status: "error",
          error: err instanceof Error ? err.message : "We couldn't check this payment.",
        }));
      }
    };
    ask(0);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [ref, kind, stage, router]);

  return result;
}
