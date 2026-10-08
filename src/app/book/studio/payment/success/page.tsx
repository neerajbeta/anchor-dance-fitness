"use client";

import { Suspense } from "react";
import { LinkButton } from "@/components/theme/LinkButton";
import { usePaymentResult } from "@/components/payments/usePaymentResult";
import {
  Actions,
  DetailCard,
  DetailRow,
  NextSteps,
  ResultGate,
  ResultHero,
  ResultLayout,
  methodLabel,
  sek,
  discountedPrice,
  VatDetailRow,
  InvoiceDetailRow,
} from "@/components/payments/ResultParts";

/** Studio Hire — payment confirmed, the slot is theirs. */
export default function StudioPaymentSuccessPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <StudioPaymentSuccess />
      </Suspense>
    </ResultLayout>
  );
}

// Studio detail is stored as "<date> · <HH:MM–HH:MM> · <purpose>".
function splitDetail(detail: string) {
  const [date, time, ...purpose] = detail.split(" · ");
  return { date, time, purpose: purpose.join(" · ") };
}

function StudioPaymentSuccess() {
  const result = usePaymentResult("studio", "success");
  if (result.status !== "paid" || !result.check) {
    return <ResultGate result={result} checkingText="Confirming your studio payment…" />;
  }

  const { booking, check } = result;
  const slot = booking ? splitDetail(booking.detail) : null;

  return (
    <>
      <ResultHero
        tone="ok"
        icon="🏛️"
        eyebrow="Studio hire confirmed"
        title="The studio is yours!"
        text={
          slot?.time
            ? `Booked for ${slot.date}, ${slot.time}. Booking #${result.ref}.`
            : `Your studio booking #${result.ref} is paid and confirmed.`
        }
      />

      <DetailCard title={`Studio booking · #${result.ref}`}>
        {booking && slot ? (
          <>
            <DetailRow k="Studio" v={booking.location} />
            <DetailRow k="Date" v={slot.date} />
            {slot.time && <DetailRow k="Time" v={slot.time} />}
            {slot.purpose && <DetailRow k="Purpose" v={slot.purpose} />}
            {booking.notes && <DetailRow k="Your notes" v={<span className="whitespace-pre-line">{booking.notes}</span>} />}
            {booking.discountCode && (
              <DetailRow k={`Discount (${booking.discountCode})`} v={`− ${sek(Math.max(0, booking.baseAmount - discountedPrice(check)))}`} />
            )}
          </>
        ) : null}
        <DetailRow k="Paid with" v={methodLabel(check.method)} />
        <VatDetailRow check={check} />
        <DetailRow k="Amount paid" v={<span className="text-ok">✓ {sek(check.amount)}</span>} strong />
        <InvoiceDetailRow check={check} />
      </DetailCard>

      <NextSteps
        title="Before you arrive"
        steps={[
          "Arrive on time — your session ends at the booked time so the next booking can start.",
          "No food or drinks in the studio, as agreed when you booked.",
          "Leave the studio as you found it: mirrors clear, equipment back in place.",
        ]}
      />

      <Actions>
        <LinkButton href="/portal">Go to My Portal →</LinkButton>
        <LinkButton href="/book/studio" variant="secondary">
          Book another slot
        </LinkButton>
      </Actions>
    </>
  );
}
