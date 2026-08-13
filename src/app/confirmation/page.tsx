"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { loadLastBooking, type LastBooking } from "@/lib/bookingDraft";

export default function ConfirmationPage() {
  const [booking, setBooking] = useState<LastBooking | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setBooking(loadLastBooking());
    setChecked(true);
  }, []);

  // Real booking (just paid via /plans → /api/bookings) — show its actual receipt.
  if (checked && booking) {
    const savings = booking.baseAmount - booking.amount;
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between bg-ink px-7">
          <LogoWordmark size={30} />
          <span className="badge badge-ok" title="Saved to PostgreSQL">
            ● Live database
          </span>
        </header>

        <main className="mx-auto w-full max-w-xl px-6 py-12 anim-fade">
          <div className="mb-2 text-center text-5xl">🎉</div>
          <h1 className="text-center font-display text-2xl font-extrabold text-ink">Booking Confirmed!</h1>
          <p className="mt-1.5 text-center text-sm text-slate">
            Your session has been booked successfully, {booking.name.split(" ")[0]}!
          </p>

          <div className="my-5 rounded-xl border-[1.5px] border-line bg-cream/60 p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">
              Receipt · #{booking.id}
            </div>
            <Row k="Student" v={booking.name} />
            <Row k="Detail" v={booking.detail} />
            {booking.category && <Row k="Category" v={booking.category} />}
            <Row k="Period" v={booking.period} />
            <Row k="Location" v={booking.location} />
            <Row k="Plan" v={booking.plan} />
            {booking.mode && (
              <div className="flex justify-between border-b border-line py-1.5 text-[13px]">
                <span className="text-muted">Mode</span>
                <span className="badge badge-info">{booking.mode === "online" ? "💻 Online" : "🏃 In-Person"}</span>
              </div>
            )}
            {booking.discountCode && (
              <div className="flex justify-between border-b border-line py-1.5 text-[13px] text-ok">
                <span>Discount ({booking.discountCode})</span>
                <span>− SEK {savings.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 text-sm font-bold">
              <span>Amount Paid</span>
              <span className="text-ok">✓ SEK {booking.amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a]">
            {booking.mode === "online" ? (
              <>
                💻 <strong>Online:</strong> A Zoom link will be sent to {booking.email} before each session.
                Batch assignment will be shared within 24 hours.
              </>
            ) : (
              <>🏃 <strong>In-person:</strong> Studio address and timing details will be emailed to {booking.email}.</>
            )}
          </div>

          <div className="flex justify-center gap-3">
            <Link href="/portal" className="btn btn-primary">
              Go to My Portal →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Fallback demo receipt — shown when this page is opened directly without a
  // real booking in this browser session.
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center bg-ink px-7">
        <LogoWordmark size={30} />
      </header>

      <main className="mx-auto w-full max-w-xl px-6 py-12 anim-fade">
        <div className="mb-2 text-center text-5xl">🎉</div>
        <h1 className="text-center font-display text-2xl font-extrabold text-ink">Booking Confirmed!</h1>
        <p className="mt-1.5 text-center text-sm text-slate">Your session has been booked successfully!</p>

        <div className="my-5 rounded-xl border-[1.5px] border-line bg-cream/60 p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">Sample Receipt</div>
          {[
            ["Student", "Priya Sharma"],
            ["Category", "Bollywood Dance · Beginner"],
            ["Period", "4 Aug – 31 Oct 2025"],
            ["Location", "Stockholm, Sweden 🇸🇪"],
            ["Plan", "Quarterly"],
          ].map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
          <div className="flex justify-between py-1.5 text-sm font-bold">
            <span>Amount Paid</span>
            <span className="text-ok">✓ SEK 1,047</span>
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <Link href="/book" className="btn btn-primary">
            Start a Real Booking →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1.5 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-ink">{v}</span>
    </div>
  );
}
