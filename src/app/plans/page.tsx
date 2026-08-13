"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { Stepper } from "@/components/Stepper";
import { PLANS } from "@/lib/data";
import { loadDraft, saveLastBooking, clearDraft, type BookingDraft } from "@/lib/bookingDraft";

export default function PlansPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [sel, setSel] = useState("quarterly");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(loadDraft());
  }, []);

  const plan = PLANS.find((p) => p.id === sel)!;
  const months = sel === "quarterly" ? 3 : sel === "biannual" ? 6 : sel === "annual" ? 12 : 1;
  // Real class price from the draft when available; otherwise fall back to the demo plan pricing.
  const base = draft ? draft.baseAmount || plan.price : plan.id === "demo" ? plan.price : plan.price * months;
  const discountAmount = applied ? Math.round((base * applied.percent) / 100) : 0;
  const total = base - discountAmount;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon, category: draft?.category, classId: draft?.classId }),
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

  async function pay() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = draft
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
            period: draft.period,
            plan: plan.name,
            paid: "paid",
            status: draft.type === "studio" ? "Confirmed" : "Pending Batch",
            statusTone: draft.type === "studio" ? "ok" : "warn",
            baseAmount: base,
            discountCode: applied ? coupon : undefined,
            classId: draft.classId,
          }
        : {
            // No draft (direct visit / demo entry) — record the membership plan itself.
            name,
            email,
            location: "Stockholm",
            flag: "🇸🇪",
            type: "class",
            detail: `${plan.name} Plan`,
            plan: plan.name,
            paid: "paid",
            status: "Active",
            statusTone: "ok",
            baseAmount: base,
            discountCode: applied ? coupon : undefined,
          };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);

      saveLastBooking({
        id: j.data.id,
        name: j.data.name,
        email: j.data.email,
        type: j.data.type,
        location: j.data.location,
        detail: j.data.detail,
        category: j.data.category,
        period: j.data.period,
        plan: j.data.plan,
        mode: j.data.mode,
        amount: j.data.amount,
        baseAmount: base,
        discountCode: j.data.discountCode,
      });
      clearDraft();
      router.push("/confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Step 2 of 3 — Choose Plan</div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8 anim-fade">
        <Stepper steps={["Your Details", "Choose Plan", "Payment"]} current={1} />

        {!draft ? (
          <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            {PLANS.map((p) => {
              const active = p.id === sel;
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(p.id)}
                  className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                    active
                      ? "border-brand-500 shadow-glow ring-2 ring-brand-500/20"
                      : "border-line bg-white hover:border-brand-300"
                  }`}
                >
                  {p.tag && (
                    <span
                      className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl px-2.5 py-0.5 text-[10px] font-bold text-white ${
                        p.id === "demo" ? "bg-ok" : "bg-brand-500"
                      }`}
                    >
                      {p.tag}
                    </span>
                  )}
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate">
                    {p.name}
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ink">
                    SEK {p.price}
                    <span className="text-[13px] font-normal text-muted">{p.unit}</span>
                  </div>
                  {p.save && <div className="mt-1 text-[11px] font-semibold text-ok">{p.save}</div>}
                  <p className="mt-1 text-[11px] leading-snug text-muted">{p.desc}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mb-6 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a]">
            <strong>Booking Summary:</strong> {draft.detail}
            {draft.category ? ` · ${draft.category}` : ""}
            {draft.level ? ` · ${draft.level}` : ""} · {draft.period} ·{" "}
            <span className="badge badge-info">{draft.mode === "online" ? "💻 Online" : "🏃 In-Person"}</span>
          </div>
        )}

        <div className="card">
          <div className="card-title">Your Details &amp; Payment</div>

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="field-label">Email *</label>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Cardholder Name</label>
              <input className="field" placeholder="Name on card" />
            </div>
            <div>
              <label className="field-label">Card Number</label>
              <input className="field" placeholder="1234 5678 9012 3456" />
            </div>
            <div>
              <label className="field-label">Expiry</label>
              <input className="field" placeholder="MM / YY" />
            </div>
            <div>
              <label className="field-label">CVV</label>
              <input className="field" placeholder="•••" />
            </div>
          </div>

          <div className="mb-4 mt-3 flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-xs text-muted">Payments are encrypted. We never store card details.</span>
          </div>

          {/* Coupon */}
          <div className="mb-4">
            <label className="field-label">Have a coupon?</label>
            <div className="flex gap-2">
              <input
                className="field uppercase"
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
                ✓ {applied.code} applied — {applied.percent}% off
              </div>
            )}
            {couponError && <div className="mt-1.5 text-[12px] font-semibold text-danger">{couponError}</div>}
          </div>

          <div className="rounded-lg border-[1.5px] border-line bg-cream/60 p-4">
            <div className="flex justify-between border-b border-line py-1.5 text-[13px]">
              <span>
                {draft ? draft.detail : plan.name}
                {!draft && plan.id !== "demo" && ` (SEK ${plan.price} × ${months} months)`}
              </span>
              <span>SEK {base.toLocaleString()}</span>
            </div>
            {applied && (
              <div className="flex justify-between border-b border-line py-1.5 text-[13px] text-ok">
                <span>Discount ({applied.code} · {applied.percent}%)</span>
                <span>− SEK {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-line py-1.5 text-[13px]">
              <span>Tax (0%)</span>
              <span>SEK 0</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm font-bold">
              <span>Total Due Today</span>
              <span className="text-brand-600">SEK {total.toLocaleString()}</span>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
              {error}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <Link href={draft?.type === "studio" ? "/book/studio" : "/book/class"} className="btn btn-ghost">
              ← Back
            </Link>
            <button className={`btn btn-primary btn-lg ${busy ? "is-disabled" : ""}`} onClick={pay}>
              {busy ? "Processing…" : `🔒 Pay SEK ${total.toLocaleString()}`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
