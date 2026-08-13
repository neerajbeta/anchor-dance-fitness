"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { StudioCalendar } from "@/components/StudioCalendar";
import { LocationSelect } from "@/components/LocationSelect";
import { STUDIO_SLOTS, STUDIO_PURPOSES, LOCATIONS } from "@/lib/data";
import { saveLastBooking } from "@/lib/bookingDraft";

const RATE = 600; // SEK per hour

export default function BookStudioPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<number, boolean>>({ 5: true, 6: true });
  const [purpose, setPurpose] = useState("");
  const [food, setFood] = useState(false);
  const [location, setLocation] = useState("Stockholm");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      STUDIO_SLOTS.map((s, i) => ({ ...s, i }))
        .filter((s) => slots[s.i] && s.state !== "taken")
        .sort((a, b) => a.i - b.i),
    [slots]
  );
  const hours = selected.length;
  const price = hours * RATE;
  const startT = selected[0]?.time ?? "—";
  const endLabel =
    selected.length > 0
      ? STUDIO_SLOTS[selected[selected.length - 1].i + 1]?.time ?? "10:00 PM"
      : "—";

  const discountAmount = applied ? Math.round((price * applied.percent) / 100) : 0;
  const total = price - discountAmount;
  const ready = purpose !== "" && food && name.trim() !== "" && email.trim() !== "" && hours > 0;

  function toggle(i: number) {
    if (STUDIO_SLOTS[i].state === "taken") return;
    setSlots((s) => ({ ...s, [i]: !s[i] }));
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon }),
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

  async function confirmBooking() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const loc = LOCATIONS.find((l) => l.label === location);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          location,
          flag: loc?.flag ?? "",
          type: "studio",
          detail: `Thu 7 Aug · ${startT}–${endLabel} · ${purpose}`,
          period: "Thu, 7 Aug 2025",
          plan: "Studio Hire",
          paid: "paid",
          status: "Confirmed",
          statusTone: "ok",
          baseAmount: price,
          discountCode: applied ? coupon : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);

      saveLastBooking({
        id: j.data.id,
        name: j.data.name,
        email: j.data.email,
        type: "studio",
        location: j.data.location,
        detail: j.data.detail,
        period: j.data.period,
        plan: j.data.plan,
        amount: j.data.amount,
        baseAmount: price,
        discountCode: j.data.discountCode,
      });
      router.push("/confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Book the Studio</div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8 anim-fade">
        <h1 className="font-display text-2xl font-bold text-ink">Studio Hire</h1>
        <p className="mb-6 text-[13px] text-slate">
          Book the full studio for personal or group use. Greyed-out slots are taken by classes,
          workshops, or existing bookings — updated in real time.
        </p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: location + calendar */}
          <div>
            <div className="card mb-4">
              <label className="field-label">Select Location</label>
              <LocationSelect withCountry value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="card">
              <div className="card-title">📅 Select a Date — August 2025</div>
              <StudioCalendar selectedDay={7} />
            </div>
          </div>

          {/* Right: slots + details */}
          <div className="flex flex-col gap-4">
            <div className="card">
              <div className="card-title">⏰ Time Slots — Thu, 7 Aug 2025</div>
              <p className="mb-2 text-[13px] text-muted">
                Tap to select hourly slots. Select multiple for longer sessions — price updates
                automatically.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {STUDIO_SLOTS.map((s, i) => {
                  const isSel = slots[i] && s.state !== "taken";
                  const taken = s.state === "taken";
                  return (
                    <button
                      key={i}
                      onClick={() => toggle(i)}
                      disabled={taken}
                      className={`rounded-lg border-[1.5px] p-2 text-center text-xs font-semibold transition-all ${
                        taken
                          ? "cursor-not-allowed border-dashed border-line bg-cream/60 text-muted line-through"
                          : isSel
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-line bg-white hover:border-brand-400 hover:bg-brand-50"
                      }`}
                    >
                      {s.time}
                      <div
                        className={`mt-0.5 text-[10px] font-normal ${
                          isSel ? "text-white/80" : "text-muted"
                        }`}
                      >
                        {isSel ? "Selected ✓" : s.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live summary */}
              <div className="mt-3.5 rounded-lg border-[1.5px] border-line bg-cream/60 p-3.5">
                <div className="mb-2 text-xs font-bold text-ink">
                  ⚡ Selection Summary{" "}
                  <span className="font-normal text-muted">(updates as you select slots)</span>
                </div>
                <Row label="Start Time" value={startT} />
                <Row label="End Time" value={endLabel} />
                <Row label="Duration" value={`${hours} Hour${hours === 1 ? "" : "s"}`} />
                <Row label="Estimated Price" value={`SEK ${price.toLocaleString()}`} accent />
              </div>
            </div>

            <div className="card">
              <div className="card-title">Booking Details</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Date</label>
                  <input className="field" value="Thu, 7 Aug 2025" readOnly />
                </div>
                <div>
                  <label className="field-label">Location</label>
                  <input className="field" value={location} readOnly />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div className="mt-3">
                <label className="field-label">
                  Purpose * <span className="text-[10px] text-danger">REQUIRED</span>
                </label>
                <select
                  className="field"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                >
                  <option value="">— Select purpose (required) —</option>
                  {STUDIO_PURPOSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <div className="mt-2 text-[11px] text-muted">
                  ⚠️ Bookings for children&apos;s parties, catering events, or social gatherings are
                  not permitted.
                </div>
              </div>

              <div className="mt-3">
                <label className="field-label">Notes (optional)</label>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="Any special requirements (e.g. mirrors, sound system)…"
                />
              </div>

              {/* Coupon */}
              <div className="mt-3">
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

              {/* Order summary */}
              <div className="my-3.5 rounded-lg border-[1.5px] border-line bg-cream/60 p-4">
                <Row label={`Studio Hire — ${hours} Hour${hours === 1 ? "" : "s"}`} value={`SEK ${price.toLocaleString()}`} />
                {applied && (
                  <Row label={`Discount (${applied.code} · ${applied.percent}%)`} value={`− SEK ${discountAmount.toLocaleString()}`} />
                )}
                <Row label="Tax (0%)" value="SEK 0" />
                <Row label="Total" value={`SEK ${total.toLocaleString()}`} accent bold />
              </div>

              {/* No food consent */}
              <button
                onClick={() => setFood((f) => !f)}
                className="mb-4 flex w-full items-start gap-3 rounded-lg border-2 border-danger/40 bg-danger/5 p-4 text-left"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 text-xs font-bold text-white transition-colors ${
                    food ? "border-danger bg-danger" : "border-danger"
                  }`}
                >
                  {food && "✓"}
                </span>
                <span className="text-[13px] leading-relaxed text-[#8a2b23]">
                  <strong>Studio Policy — No Food or Drinks</strong>
                  <br />
                  I confirm that no food or beverages will be brought into the studio premises during
                  my booking. Violation may result in cancellation without refund.{" "}
                  <span className="font-bold text-danger">* Required to proceed.</span>
                </span>
              </button>

              {error && (
                <div className="mb-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                  {error}
                </div>
              )}

              <button
                onClick={confirmBooking}
                className={`btn btn-grape btn-block btn-lg ${ready && !busy ? "" : "is-disabled"}`}
              >
                {busy ? "Booking…" : "🏛️ Confirm Studio Booking"}
              </button>
              <div className="mt-2 text-center text-[11px] text-muted">
                Fill your name, email, purpose and accept the studio policy to enable booking.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={`${bold ? "font-bold" : "font-semibold"} ${accent ? "text-brand-600" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}
