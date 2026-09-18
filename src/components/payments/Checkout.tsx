"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveLastBooking } from "@/lib/bookingDraft";
import { paymentPageUrl } from "@/lib/payments/pages";

export type PayMethod = "stripe" | "swish";

/** The booking row the checkout endpoint hands back. */
export type BookingRow = {
  id: string;
  name: string;
  email: string;
  type: "class" | "workshop" | "event" | "studio";
  location: string;
  detail: string;
  category?: string | null;
  period: string;
  plan: string;
  mode?: "online" | "offline" | null;
  amount: number;
  discountCode?: string | null;
  notes?: string | null;
};

/** A Swish request waiting for the payer to approve it in their app. */
type SwishPending = { row: BookingRow; amount: number; payeeAlias: string; appLink: string };

/**
 * Checkout shared by every self-service booking (Class, Workshops & Events,
 * Studio Hire). Starts a Stripe or Swish payment and sends the customer to
 * that booking type's own success / pending / cancelled pages.
 */
export function useCheckout() {
  const router = useRouter();
  const [methods, setMethods] = useState<{ stripe: boolean; swish: boolean } | null>(null);
  const [method, setMethod] = useState<PayMethod>("stripe");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swish, setSwish] = useState<SwishPending | null>(null);

  useEffect(() => {
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((j) => {
        const m = j.data as { stripe: boolean; swish: boolean };
        setMethods(m);
        // Don't preselect a gateway this deployment can't actually charge through.
        if (!m.stripe && m.swish) setMethod("swish");
      })
      .catch(() => {});
  }, []);

  /**
   * Starts payment. `booking` is what gets recorded; the server works out the
   * price itself. `baseAmount` is only for the receipt shown afterwards.
   */
  async function pay(booking: Record<string, unknown>, baseAmount: number) {
    if (busy || swish) return;
    if (methods && !methods[method]) {
      setError("That payment method isn't available right now — please pick the other one.");
      return;
    }
    if (method === "swish" && !phone.trim()) {
      setError("Enter the mobile number connected to your Swish.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, phone, booking }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      const row = j.data.registration as BookingRow;

      // The receipt the success page shows — saved before leaving for Stripe or
      // opening Swish, so it's there whichever way the payer comes back.
      saveLastBooking({
        id: row.id,
        name: row.name,
        email: row.email,
        type: row.type,
        location: row.location,
        detail: row.detail,
        category: row.category ?? undefined,
        period: row.period,
        plan: row.plan,
        mode: row.mode ?? undefined,
        amount: row.amount,
        baseAmount,
        discountCode: row.discountCode,
        notes: row.notes,
      });

      if (j.data.settled) {
        // Nothing left to charge (a 100% discount).
        router.push(paymentPageUrl(row.type, "success", row.id));
        return;
      }
      if (method === "stripe") {
        // Card details are entered on Stripe's own page, which returns to this
        // booking type's success or cancelled page.
        window.location.assign(j.data.redirectUrl as string);
        return;
      }
      setSwish({ row, ...(j.data.swish as Omit<SwishPending, "row">) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  // While a Swish request is open, ask our server (which asks Swish) how it went.
  useEffect(() => {
    if (!swish) return;
    const { row } = swish;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/verify?id=${encodeURIComponent(row.id)}`, { cache: "no-store" });
        const j = await res.json();
        if (stopped || !res.ok) return;
        if (j.data?.state === "paid") {
          clearInterval(timer);
          router.push(paymentPageUrl(row.type, "success", row.id));
        } else if (j.data?.state === "failed") {
          clearInterval(timer);
          router.push(paymentPageUrl(row.type, "cancelled", row.id));
        }
      } catch {
        /* transient — the next tick retries */
      }
    }, 3000);
    // No answer after 3 minutes — the pending page keeps checking from there.
    const handOff = setTimeout(() => {
      stopped = true;
      clearInterval(timer);
      router.push(paymentPageUrl(row.type, "pending", row.id));
    }, 3 * 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(handOff);
    };
  }, [swish, router]);

  const overlay = swish ? (
    <SwishWaiting pending={swish} onCancel={() => router.push(paymentPageUrl(swish.row.type, "cancelled", swish.row.id))} />
  ) : null;

  return {
    methods,
    method,
    setMethod,
    phone,
    setPhone,
    busy,
    error,
    setError,
    pay,
    /** Render once anywhere on the page — the "Waiting for Swish" screen. */
    overlay,
    /** True while a payment is starting or waiting in Swish. */
    inProgress: busy || Boolean(swish),
    methodReady: !methods || methods[method],
  };
}

/** Card / Swish choice, plus the Swish mobile number when Swish is picked. */
export function PaymentMethodPicker({ checkout }: { checkout: ReturnType<typeof useCheckout> }) {
  const { methods, method, setMethod, phone, setPhone } = checkout;
  return (
    <>
      <div className="mb-3">
        <label className="t-label">Payment Method *</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MethodCard
            selected={method === "stripe"}
            disabled={methods !== null && !methods.stripe}
            onSelect={() => setMethod("stripe")}
            icon="💳"
            title="Card"
            subtitle="Visa, Mastercard & more — paid securely on Stripe."
          />
          <MethodCard
            selected={method === "swish"}
            disabled={methods !== null && !methods.swish}
            onSelect={() => setMethod("swish")}
            icon="🇸🇪"
            title="Swish"
            subtitle="Approve the request in your Swish app."
          />
        </div>
      </div>

      {method === "swish" && (
        <div className="mb-3">
          <label className="t-label">Swish Mobile Number *</label>
          <input
            className="t-field"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="070 123 45 67"
          />
          <p className="mt-1 text-[11px] text-copy-dim">
            The Swedish mobile number your Swish is connected to. We&apos;ll send the request there.
          </p>
        </div>
      )}

      <div className="mb-4 mt-3 flex items-center gap-2">
        <span className="text-lg">🔒</span>
        <span className="text-xs text-copy-dim">
          {method === "stripe"
            ? "You'll be taken to Stripe to pay — card details are never entered on this site."
            : "Nothing is charged until you approve the request in your Swish app."}
        </span>
      </div>
    </>
  );
}

function MethodCard({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
        disabled
          ? "cursor-not-allowed border-hairline bg-surface-muted/40 opacity-60"
          : selected
          ? "border-accent bg-accent/[0.06] ring-2 ring-accent/20"
          : "border-hairline bg-surface hover:border-accent/50"
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span>
        <span className="block text-[13px] font-bold text-copy">
          {title}
          {disabled ? " · unavailable" : ""}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-copy-dim">{subtitle}</span>
      </span>
    </button>
  );
}

/** Blocking panel shown while the payer approves the request in their Swish app. */
function SwishWaiting({ pending, onCancel }: { pending: SwishPending; onCancel: () => void }) {
  return (
    <div className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="animate-sheet w-full max-w-sm rounded-[18px] border border-hairline bg-surface p-6 text-center shadow-[var(--shadow-lg)]">
        <div className="mb-2 text-4xl">📲</div>
        <h2 className="font-oswald text-xl font-bold italic text-copy">Waiting for Swish</h2>
        <p className="mt-1.5 text-[13px] text-copy-dim">Open the Swish app on your phone to approve the payment.</p>
        <div className="my-4 rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-3 text-[13px]">
          <div className="flex justify-between py-0.5">
            <span className="text-copy-dim">Amount</span>
            <span className="font-bold">SEK {pending.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-copy-dim">To</span>
            <span>{pending.payeeAlias}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-copy-dim">Booking</span>
            <span>#{pending.row.id}</span>
          </div>
        </div>
        {/* On a phone this hands straight over to the Swish app; on desktop the push notification does. */}
        <a href={pending.appLink} className="btn btn-primary w-full sm:hidden">
          Open Swish app
        </a>
        <button className="btn btn-ghost mt-2 w-full" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
