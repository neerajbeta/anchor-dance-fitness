"use client";

import { useEffect, useState } from "react";
import { SessionStudentNav } from "@/components/theme/shells";
import { LinkButton } from "@/components/theme/LinkButton";
import { BookingReceipt } from "@/components/BookingReceipt";
import { clearDraft, loadLastBooking, type LastBooking } from "@/lib/bookingDraft";

// Receipt for bookings confirmed without an online payment (e.g. Studio Hire).
// Paid bookings (Stripe / Swish) finish on each booking type's own /book/<type>/payment/* pages.
export default function ConfirmationPage() {
  const [booking, setBooking] = useState<LastBooking | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setBooking(loadLastBooking());
    setChecked(true);
    // End of the flow — drop the selection so a fresh booking starts clean.
    clearDraft();
  }, []);

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />

      <main className="animate-enter mx-auto w-full max-w-xl px-4 py-12">
        {!checked ? null : booking ? (
          <>
            <div className="mb-2 text-center text-5xl">🎉</div>
            <h1 className="text-center font-oswald text-2xl font-extrabold italic text-copy">
              Booking Confirmed!
            </h1>
            <p className="mt-1.5 text-center text-sm text-copy-dim">
              Your session has been booked successfully, {booking.name.split(" ")[0]}!
            </p>
            <BookingReceipt booking={booking} />
          </>
        ) : (
          <NoRecentBooking />
        )}
      </main>
    </div>
  );
}

function NoRecentBooking() {
  return (
    <>
      <div className="mb-2 text-center text-5xl">🧾</div>
      <h1 className="text-center font-oswald text-2xl font-extrabold italic text-copy">
        No recent booking
      </h1>
      <p className="mt-1.5 text-center text-sm text-copy-dim">
        There&apos;s no just-completed booking in this browser. Your bookings and receipts are
        always available in your portal.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/portal" variant="secondary">
          Go to My Portal
        </LinkButton>
        <LinkButton href="/book">Book a Session →</LinkButton>
      </div>
    </>
  );
}
