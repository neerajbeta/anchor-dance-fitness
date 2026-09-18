"use client";

import Link from "next/link";
import { STUDIO_LOCATIONS, studioLocationFlag } from "@/lib/studioLocations";
import { useEffect, useState } from "react";
import { SessionStudentNav } from "@/components/theme/shells";
import { StudioCalendar, type StudioBlockRange } from "@/components/StudioCalendar";
import { LocationSelect } from "@/components/LocationSelect";
import { PaymentMethodPicker, useCheckout } from "@/components/payments/Checkout";

const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}


// Full 24h, 30-min steps: 00:00 → 23:30
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

// Real availability from /api/studio/taken (blocked slots + existing bookings).
type TakenRange = { start: string; end: string; reason: "Blocked" | "Booked" };

// Select value for "Other" — can't collide with an admin-defined purpose name.
const OTHER_PURPOSE = "__other__";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Does [start, start + minutes) overlap any taken range? */
function overlaps(ranges: TakenRange[], start: string, minutes: number) {
  const s = toMin(start);
  const e = s + minutes;
  return ranges.some((r) => s < toMin(r.end) && toMin(r.start) < e);
}

export default function BookStudioPage() {
  const [startT, setStartT] = useState("11:00");
  const [hours, setHours] = useState(2);
  const [purpose, setPurpose] = useState("");
  // "Other" lets the customer describe a purpose that isn't in the admin list.
  const [otherPurpose, setOtherPurpose] = useState("");
  const chosenPurpose = purpose === OTHER_PURPOSE ? otherPurpose.trim() : purpose;
  const [notes, setNotes] = useState("");
  const [food, setFood] = useState(false);
  // Studio hire only runs at the fixed venues in STUDIO_LOCATIONS.
  const [location, setLocation] = useState(STUDIO_LOCATIONS[0].label);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [blocks, setBlocks] = useState<StudioBlockRange[]>([]);
  const [taken, setTaken] = useState<TakenRange[]>([]);
  // Hourly rate + purposes come from admin Portal Settings; flags from the Locations table.
  const [rate, setRate] = useState<number | null>(null);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  /** null until /api/auth/me answers. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [coupon, setCoupon] = useState("");

  // Signed in — the booking is always recorded against this account (the
  // server forces it), so show those details instead of a blank form.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return setSignedIn(false);
        setSignedIn(true);
        setName(j.data.name);
        setEmail(j.data.email);
      })
      .catch(() => setSignedIn(false));
  }, []);
  const [applied, setApplied] = useState<{
    code: string;
    type: "percent" | "flat";
    percent: number;
    flatAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Studio Hire is paid up front by card or Swish, like every other booking.
  const checkout = useCheckout();
  const { error } = checkout;

  // TIME_SLOTS is in 30-min steps, so 1 hour = 2 slots.
  const endLabel = startT
    ? TIME_SLOTS[(TIME_SLOTS.indexOf(startT) + hours * 2) % TIME_SLOTS.length] ?? "—"
    : "—";
  const price = hours * (rate ?? 0);

  const discountAmount = applied
    ? applied.type === "flat"
      ? Math.min(price, applied.flatAmount)
      : Math.round((price * applied.percent) / 100)
    : 0;
  const total = price - discountAmount;
  const clash = startT !== "" && overlaps(taken, startT, hours * 60);
  const ready =
    chosenPurpose !== "" && food && name.trim() !== "" && email.trim() !== "" && hours > 0 && startT !== "" && !clash && rate !== null;

  useEffect(() => {
    fetch("/api/studio/blocks")
      .then((r) => r.json())
      .then((j) => setBlocks(j.data ?? []));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setRate(j.data?.studioHourlyRate ?? null);
        setPurposes(j.data?.studioPurposes ?? []);
      })
      .catch(() => {});
  }, []);

  // Real availability for the chosen location + date.
  useEffect(() => {
    if (!location) return;
    const qs = new URLSearchParams({ location, date: selectedDate });
    fetch(`/api/studio/taken?${qs}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setTaken(j.data ?? []))
      .catch(() => setTaken([]));
  }, [location, selectedDate]);

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon, bookingType: "studio" }),
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

  function confirmBooking() {
    if (!ready) return;
    checkout.pay(
      {
        name,
        email,
        location,
        flag: studioLocationFlag(location),
        type: "studio",
        detail: `${formatDateLabel(selectedDate)} · ${startT}–${endLabel} · ${chosenPurpose}`,
        period: formatDateLabel(selectedDate),
        // ISO date so the server can re-check the slot is still free before charging.
        slotDate: selectedDate,
        plan: "Studio Hire",
        status: "Confirmed",
        statusTone: "ok",
        discountCode: applied ? coupon : undefined,
        notes,
      },
      price
    );
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />

      <main className="animate-enter mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="font-oswald text-3xl font-semibold italic text-copy">Studio Hire</h1>
        <p className="mb-6 mt-1 text-[13px] text-copy-dim">
          Book the full studio for personal or group use. Greyed-out slots are taken by classes,
          workshops, or existing bookings — updated in real time.
        </p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: location + calendar */}
          <div>
            <div className="surface-card p-5 md:p-6 mb-4">
              <label className="t-label">Select Location</label>
              <LocationSelect studio value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="surface-card p-5 md:p-6">
              <div className="mb-4 font-display text-sm font-bold text-copy">📅 Select a Date</div>
              <StudioCalendar
                blocks={blocks}
                locationFilter={location}
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialMonth={selectedDate}
              />
            </div>
          </div>

          {/* Right: slots + details */}
          <div className="flex flex-col gap-4">
            <div className="surface-card p-5 md:p-6">
              <div className="mb-4 font-display text-sm font-bold text-copy">⏰ Time — {formatDateLabel(selectedDate)}</div>
              <p className="mb-2 text-[13px] text-copy-dim">
                Pick a start time and duration — greyed-out hours are already taken by classes,
                workshops, or existing bookings. Price updates automatically.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="t-label">Start Time *</label>
                  <select className="t-field" value={startT} onChange={(e) => setStartT(e.target.value)}>
                    <option value="" disabled>
                      Select
                    </option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t} disabled={overlaps(taken, t, 30)}>
                        {t}
                        {overlaps(taken, t, 30) ? " — Taken" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="t-label">Duration *</label>
                  <select className="t-field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((h) => (
                      <option key={h} value={h}>
                        {h} Hour{h > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live summary */}
              <div className="mt-3.5 rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-3.5">
                <div className="mb-2 text-xs font-bold text-copy">
                  ⚡ Selection Summary{" "}
                  <span className="font-normal text-copy-dim">(updates as you choose time)</span>
                </div>
                <Row label="Start Time" value={startT || "—"} />
                <Row label="End Time" value={endLabel} />
                <Row label="Duration" value={`${hours} Hour${hours === 1 ? "" : "s"}`} />
                <Row label="Estimated Price" value={`SEK ${price.toLocaleString()}`} accent />
                {clash && (
                  <div className="mt-2 text-[12px] font-semibold text-danger">
                    ⚠️ This time overlaps an existing booking or blocked slot — pick another start
                    time or a shorter duration.
                  </div>
                )}
              </div>
            </div>

            <div className="surface-card p-5 md:p-6">
              <div className="mb-4 font-display text-sm font-bold text-copy">Booking Details</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="t-label">Date</label>
                  <input className="t-field" value={formatDateLabel(selectedDate)} readOnly />
                </div>
                <div>
                  <label className="t-label">Location</label>
                  <input className="t-field" value={location} readOnly />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <p className="mt-1.5 text-[11px] text-copy-dim">
                  Booking as <strong className="text-copy">{email}</strong> — this booking goes to your account.
                </p>
              )}
              {signedIn === false && (
                <p className="mt-1.5 text-[11px] text-copy-dim">
                  <Link href="/login" className="font-semibold text-accent">
                    Sign in
                  </Link>{" "}
                  to book with your saved details and see this booking in your portal.
                </p>
              )}

              <div className="mt-3">
                <label className="t-label">
                  Purpose * <span className="text-[10px] text-danger">REQUIRED</span>
                </label>
                <select
                  className="t-field"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                >
                  <option value="">— Select purpose (required) —</option>
                  {purposes.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                  <option value={OTHER_PURPOSE}>Other (describe your purpose)</option>
                </select>
                {purpose === OTHER_PURPOSE && (
                  <div className="mt-2">
                    <input
                      className="t-field"
                      value={otherPurpose}
                      onChange={(e) => setOtherPurpose(e.target.value.slice(0, 120))}
                      placeholder="e.g. Dance audition prep, choreography workshop…"
                      maxLength={120}
                      autoFocus
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-copy-dim">
                      <span>{otherPurpose.trim() ? "" : "Tell us what you'll use the studio for (required)."}</span>
                      <span>{otherPurpose.length}/120</span>
                    </div>
                  </div>
                )}
                <div className="mt-2 text-[11px] text-copy-dim">
                  ⚠️ Bookings for children&apos;s parties, catering events, or social gatherings are
                  not permitted.
                </div>
              </div>

              <div className="mt-3">
                <label className="t-label">Notes (optional)</label>
                <textarea
                  className="t-field"
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements (e.g. mirrors, sound system)…"
                />
                <div className="mt-1 text-right text-[11px] text-copy-dim">{notes.length}/500</div>
              </div>

              {/* Coupon */}
              <div className="mt-3">
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

              {/* Order summary */}
              <div className="my-3.5 rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-4">
                <Row label={`Studio Hire — ${hours} Hour${hours === 1 ? "" : "s"}`} value={`SEK ${price.toLocaleString()}`} />
                {applied && (
                  <Row label={`Discount (${applied.code} · ${applied.type === "flat" ? `SEK ${applied.flatAmount}` : `${applied.percent}%`})`} value={`− SEK ${discountAmount.toLocaleString()}`} />
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

              <PaymentMethodPicker checkout={checkout} />

              {error && (
                <div className="mb-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                  {error}
                </div>
              )}

              <button
                onClick={confirmBooking}
                className={`btn btn-grape btn-block btn-lg ${ready && !checkout.inProgress && checkout.methodReady ? "" : "is-disabled"}`}
              >
                {checkout.busy
                  ? "Processing…"
                  : `🔒 Pay SEK ${total.toLocaleString()} ${checkout.method === "swish" ? "with Swish" : "by card"}`}
              </button>
              <div className="mt-2 text-center text-[11px] text-copy-dim">
                Fill your name, email, purpose and accept the studio policy to enable booking. Your slot is
                held for 15 minutes while you pay.
              </div>
            </div>
          </div>
        </div>
      </main>

      {checkout.overlay}
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
      <span className="text-copy-dim">{label}</span>
      <span className={`${bold ? "font-bold" : "font-semibold"} ${accent ? "text-accent" : "text-copy"}`}>
        {value}
      </span>
    </div>
  );
}
