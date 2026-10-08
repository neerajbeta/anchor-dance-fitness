"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Layers, Ticket } from "lucide-react";
import { SessionStudentNav } from "@/components/theme/shells";
import { Stepper } from "@/components/theme/Stepper";
import { LocationSelect } from "@/components/LocationSelect";
import {
  INTERVAL_MONTHS,
  isTrialPlan,
  monthsBetween,
  planSavings,
  plansForMonths,
  planTotal,
  sortPlans,
  type Plan,
} from "@/lib/plans";
import { loadDraft, type BookingDraft } from "@/lib/bookingDraft";
import { ConsentGate, PaymentMethodPicker, useCheckout } from "@/components/payments/Checkout";
import { useVatRules } from "@/lib/useVatRules";
import { applyVat, formatVatRate, vatPriceNote, vatRuleFor } from "@/lib/vat";

type Loc = { id: string; label: string; flag: string | null };

export default function PlansPage() {
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [sel, setSel] = useState("");
  const [planLocation, setPlanLocation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  /** null until /api/auth/me answers. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    type: "percent" | "flat";
    percent: number;
    flatAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const checkout = useCheckout();
  const { error, setError, setConsent } = checkout;

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
    // They already ticked the GDPR box on the class step — carry it over.
    if (d?.consent) setConsent(d.consent);
    // Signed in (e.g. auto-login right after registering) — prefill their details.
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) {
          setSignedIn(false);
          return;
        }
        // Signed in — the booking is always recorded against this account
        // (the server forces it), so show those details rather than a blank form.
        setSignedIn(true);
        setName(j.data.name);
        setEmail(j.data.email);
      })
      .catch(() => {});
    fetch("/api/plans")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Couldn't load plans");
        // The trial plan is offered here too — one class at the trial price,
        // so someone can try a batch before committing to a term.
        setPlans(sortPlans((j.data ?? []) as Plan[]));
      })
      .catch((err) => {
        setPlans([]);
        setPlansError(err instanceof Error ? err.message : "Couldn't load plans");
      });
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocs(j.data ?? []))
      .catch(() => {});
  }, [setConsent]);

  // Class bookings and plan-only purchases choose a plan; workshops/events/studio are one-time.
  const choosesPlan = !draft || draft.type === "class";

  // Only offer plans that fit the dates the customer picked — a 1-month
  // booking shows Monthly, not Quarterly/Bi-Annual/Annual.
  const bookedMonths = useMemo(() => {
    if (draft?.type !== "class") return null;
    // Older drafts only carry the "start – end" display string.
    const [s, e] = draft.startDate ? [draft.startDate, draft.endDate] : draft.period.split(" – ");
    return monthsBetween(s, e);
  }, [draft]);
  const shownPlans = useMemo(() => (plans ? plansForMonths(plans, bookedMonths) : null), [plans, bookedMonths]);

  // Keep the selection valid: default to the longest plan that fits the booking.
  useEffect(() => {
    if (!shownPlans?.length) return;
    if (!shownPlans.some((p) => p.id === sel)) setSel(shownPlans[shownPlans.length - 1].id);
  }, [shownPlans, sel]);

  const plan = shownPlans?.find((p) => p.id === sel) ?? null;
  const months = plan ? INTERVAL_MONTHS[plan.interval] : 0;
  // A trial is a single class at the trial price — not the term the customer
  // picked, and never multiplied by the class's monthly price.
  const isTrial = Boolean(plan && isTrialPlan(plan));
  // planTotal() already ignores this for the trial plan (it charges once).
  const classPrice = draft?.type === "class" && draft.baseAmount > 0 ? draft.baseAmount : null;
  const base = !choosesPlan ? draft?.baseAmount ?? 0 : plan ? planTotal(plan, classPrice) : 0;
  const discountAmount = applied
    ? applied.type === "flat"
      ? Math.min(base, applied.flatAmount)
      : Math.round((base * applied.percent) / 100)
    : 0;
  // VAT per the admin VAT master — the same sum the server charges.
  const vatRules = useVatRules();
  const vatRule = vatRuleFor(vatRules, draft?.type ?? "class");
  const vat = applyVat(base - discountAmount, vatRule);
  const total = vat.total;

  const monthlyPlan = plans?.find((p) => p.interval === "monthly") ?? null;
  // "Best value" = the plan-only option with the biggest saving vs paying monthly.
  const bestValueId = useMemo(() => {
    if (!shownPlans || classPrice) return null;
    let best: Plan | null = null;
    for (const p of shownPlans) {
      const s = planSavings(p, monthlyPlan);
      if (s > 0 && (!best || s > planSavings(best, monthlyPlan))) best = p;
    }
    return best?.id ?? null;
  }, [shownPlans, monthlyPlan, classPrice]);

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: coupon,
          category: draft?.category,
          classId: draft?.classId,
          eventId: draft?.eventId,
          bookingType: draft?.type,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Invalid code");
      setApplied(j.data);
    } catch (err) {
      setApplied(null);
      setCouponError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setChecking(false);
    }
  }

  function pay() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (choosesPlan && !plan) {
      setError("Please choose a plan.");
      return;
    }
    if (!draft && !planLocation) {
      setError("Please choose your studio location.");
      return;
    }
    const planName = choosesPlan && plan ? plan.name : "One-time";
    // A trial is one class on the start date, so it isn't recorded as a term.
    const trialDate = draft?.startDate ?? draft?.period.split(" – ")[0] ?? "";
    const booking = draft
      ? {
          name,
          email,
          location: draft.location,
          flag: draft.flag,
          type: draft.type,
          detail: draft.detail,
          category: draft.category,
          level: draft.level,
          mode: draft.mode,
          period: isTrial && trialDate ? trialDate : draft.period,
          plan: planName,
          status: isTrial ? "Trial Booked" : draft.type === "class" ? "Pending Batch" : "Confirmed",
          statusTone: draft.type === "class" ? "warn" : "ok",
          discountCode: applied ? coupon : undefined,
          classId: draft.classId,
          eventId: draft.eventId,
        }
      : {
          // No draft (plan-only purchase) — record the membership plan itself.
          name,
          email,
          location: planLocation,
          flag: locs.find((l) => l.label === planLocation)?.flag ?? "",
          type: "class",
          detail: `${planName} Plan`,
          plan: planName,
          status: "Active",
          statusTone: "ok",
          discountCode: applied ? coupon : undefined,
        };
    checkout.pay(booking, base);
  }

  const canPay = !checkout.inProgress && checkout.methodReady && checkout.consentReady && (!choosesPlan || !!plan);

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />

      <main className="animate-enter mx-auto w-full max-w-4xl px-4 py-10">
        {choosesPlan ? (
          <Stepper
            steps={["Class Details", "Choose Plan", "Pay & Confirm"]}
            icons={[CalendarDays, Layers, CreditCard]}
            current={1}
            subtitle="Choose a plan, add a coupon if you have one, then pay by card or Swish."
          />
        ) : (
          <Stepper
            steps={["Choose Event", "Pay & Confirm"]}
            icons={[Ticket, CreditCard]}
            current={1}
            subtitle="Check your booking, add a coupon if you have one, then pay by card or Swish."
          />
        )}

        {draft && (
          <div className="mb-6 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a] dark:text-sky-200">
            <strong>Booking Summary:</strong> {draft.detail}
            {draft.category ? ` · ${draft.category}` : ""}
            {draft.level ? ` · ${draft.level}` : ""} · {draft.period}
            {classPrice ? ` · SEK ${classPrice.toLocaleString()} / month` : ""}
            {vatRule ? ` (${vatPriceNote(vatRule)})` : ""} ·{" "}
            <span className="badge badge-info">{draft.mode === "online" ? "💻 Online" : "🏃 In-Person"}</span>
          </div>
        )}

        {choosesPlan &&
          (shownPlans === null ? (
            <div className="mb-6 rounded-lg border-[1.5px] border-hairline bg-surface-muted/40 px-4 py-6 text-center text-[13px] text-copy-dim">
              Loading plans…
            </div>
          ) : shownPlans.length === 0 ? (
            <div className="mb-6 rounded-lg border-[1.5px] border-dashed border-hairline bg-surface-muted/40 px-4 py-6 text-center text-[13px] text-copy-dim">
              {plansError ?? "No plans are available yet — please contact the studio."}
            </div>
          ) : (
            <>
            {bookedMonths && plans && shownPlans.length < plans.length && (
              <p className="mb-3 text-[12px] text-copy-dim">
                📅 Showing plans that fit your {bookedMonths}-month booking. Need a longer plan?{" "}
                <Link href="/book/class" className="font-semibold text-accent">
                  Change your dates
                </Link>
              </p>
            )}
            {isTrial && (
              <p className="mb-3 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-2.5 text-[12px] text-[#245a8a] dark:text-sky-200">
                🎟️ You&apos;ve picked the trial — that&apos;s <strong>one class</strong>
                {draft?.startDate ? ` on ${draft.startDate}` : ""}, charged once. Your dates only apply if you choose a
                membership plan instead.
              </p>
            )}
            <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {shownPlans.map((p) => {
                const active = p.id === sel;
                const pMonths = INTERVAL_MONTHS[p.interval];
                const cardTotal = planTotal(p, classPrice);
                const trial = isTrialPlan(p);
                const savings = classPrice || trial ? 0 : planSavings(p, monthlyPlan);
                const tag = trial ? "TRY IT FIRST" : p.id === bestValueId ? "BEST VALUE" : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSel(p.id)}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                      active
                        ? "border-accent shadow-[0_10px_28px_rgba(235,57,54,0.28)] ring-2 ring-accent/20"
                        : "border-hairline bg-surface hover:border-accent/50"
                    }`}
                  >
                    {tag && (
                      <span
                        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-2.5 py-0.5 text-[10px] font-bold text-white ${
                          trial ? "bg-info" : "bg-accent"
                        }`}
                      >
                        {tag}
                      </span>
                    )}
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-copy-dim">{p.name}</div>
                    {classPrice && pMonths > 0 ? (
                      <>
                        <div className="font-display text-2xl font-extrabold text-copy">
                          SEK {cardTotal.toLocaleString()}
                        </div>
                        <div className="mt-0.5 text-[11px] text-copy-dim">
                          SEK {classPrice.toLocaleString()}/mo × {pMonths}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-display text-2xl font-extrabold text-copy">
                          SEK {p.price.toLocaleString()}
                          <span className="text-[13px] font-normal text-copy-dim">{pMonths > 0 ? "/mo" : ""}</span>
                        </div>
                        {pMonths > 1 && (
                          <div className="mt-0.5 text-[11px] text-copy-dim">
                            SEK {cardTotal.toLocaleString()} every {pMonths} months
                          </div>
                        )}
                      </>
                    )}
                    {vatRule ? (
                      <div className="mt-0.5 text-[10px] font-semibold text-copy-dim">{vatPriceNote(vatRule)}</div>
                    ) : null}
                    {savings > 0 && (
                      <div className="mt-1 text-[11px] font-semibold text-ok">Save SEK {savings.toLocaleString()}</div>
                    )}
                    {trial && (
                      <div className="mt-1 text-[11px] font-semibold text-info">One class · charged once</div>
                    )}
                    {p.description && <p className="mt-1 text-[11px] leading-snug text-copy-dim">{p.description}</p>}
                  </button>
                );
              })}
            </div>
            </>
          ))}

        <div className="surface-card p-5 md:p-6">
          <div className="mb-4 font-display text-sm font-bold text-copy">Your Details &amp; Payment</div>

          {!draft && (
            <div className="mb-3">
              <label className="t-label">Studio Location *</label>
              <LocationSelect
                withCountry
                allOption="Select your studio location"
                value={planLocation}
                onChange={(e) => setPlanLocation(e.target.value)}
              />
            </div>
          )}

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="t-label">Full Name *</label>
              <input
                className="t-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                readOnly={signedIn === true}
              />
            </div>
            <div>
              <label className="t-label">Email *</label>
              <input
                className="t-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                readOnly={signedIn === true}
              />
            </div>
          </div>

          {signedIn === true && (
            <p className="mb-3 text-[11px] text-copy-dim">
              Booking as <strong className="text-copy">{email}</strong> — this booking goes to your account.
            </p>
          )}
          {signedIn === false && (
            <p className="mb-3 text-[11px] text-copy-dim">
              <Link href="/login" className="font-semibold text-accent">
                Sign in
              </Link>{" "}
              to book with your saved details and see this booking in your portal.
            </p>
          )}

          {/* Coupon — applied before the payment method, so the amount is final
              by the time the payer is sent to Stripe or Swish. */}
          <div className="mb-4">
            <label className="t-label">Have a coupon?</label>
            <div className="flex gap-2">
              <input
                className="t-field uppercase"
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  setApplied(null);
                  setCouponError(null);
                }}
                placeholder="e.g. SUMMER20"
              />
              <button className="btn btn-ghost btn-sm" onClick={applyCoupon} disabled={checking}>
                {checking ? "…" : "Apply"}
              </button>
            </div>
            {applied && (
              <div className="mt-1.5 text-[12px] font-semibold text-ok">
                ✓ {applied.code} applied — {applied.type === "flat" ? `SEK ${applied.flatAmount} off` : `${applied.percent}% off`}
              </div>
            )}
            {couponError && <div className="mt-1.5 text-[12px] font-semibold text-danger">{couponError}</div>}
          </div>

          {/* Payment method — the actual payment happens at Stripe or in the Swish app. */}
          <PaymentMethodPicker checkout={checkout} />

          <ConsentGate checkout={checkout} />

          <div className="rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-4">
            <div className="flex justify-between gap-3 border-b border-hairline py-1.5 text-[13px]">
              <span>
                {draft ? draft.detail : plan?.name ?? "Choose a plan"}
                {draft && choosesPlan && plan ? ` · ${plan.name}` : ""}
                {choosesPlan && plan && months > 0
                  ? ` (SEK ${(classPrice ?? plan.price).toLocaleString()} × ${months} month${months === 1 ? "" : "s"})`
                  : ""}
              </span>
              <span className="whitespace-nowrap">SEK {base.toLocaleString()}</span>
            </div>
            {applied && (
              <div className="flex justify-between border-b border-hairline py-1.5 text-[13px] text-ok">
                <span>Discount ({applied.code} · {applied.type === "flat" ? `SEK ${applied.flatAmount}` : `${applied.percent}%`})</span>
                <span>− SEK {discountAmount.toLocaleString()}</span>
              </div>
            )}
            {vat.mode ? (
              <div className="flex justify-between border-b border-hairline py-1.5 text-[13px]">
                <span>
                  {vat.mode === "exclusive" ? "VAT" : "Includes VAT"} ({formatVatRate(vat.rateBp)})
                </span>
                <span>
                  {vat.mode === "exclusive" ? "+ " : ""}SEK {vat.vat.toLocaleString()}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between py-1.5 text-sm font-bold">
              <span>Total Due Today</span>
              <span className="text-accent">SEK {total.toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <Link
              href={
                draft?.type === "studio"
                  ? "/book/studio"
                  : draft?.type === "workshop" || draft?.type === "event"
                  ? "/book/workshops"
                  : "/book/class"
              }
              className="btn btn-ghost"
            >
              ← Back
            </Link>
            <button className={`btn btn-primary btn-lg ${canPay ? "" : "is-disabled"}`} onClick={pay}>
              {checkout.busy
                ? "Processing…"
                : `🔒 Pay SEK ${total.toLocaleString()} ${checkout.method === "swish" ? "with Swish" : "by card"}`}
            </button>
          </div>
        </div>
      </main>

      {checkout.overlay}
    </div>
  );
}

