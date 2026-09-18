"use client";

import { Suspense } from "react";
import { LinkButton } from "@/components/theme/LinkButton";
import { Badge } from "@/components/theme/Card";
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
} from "@/components/payments/ResultParts";

/** Workshop / event booking — payment confirmed. */
export default function WorkshopPaymentSuccessPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <WorkshopPaymentSuccess />
      </Suspense>
    </ResultLayout>
  );
}

function WorkshopPaymentSuccess() {
  const result = usePaymentResult("workshop", "success");
  if (result.status !== "paid" || !result.check) {
    return <ResultGate result={result} checkingText="Confirming your ticket payment…" />;
  }

  const { booking, check } = result;
  const isEvent = check.type === "event";
  const what = isEvent ? "event" : "workshop";
  const firstName = booking?.name.split(" ")[0];

  return (
    <>
      <ResultHero
        tone="ok"
        icon="🎟️"
        eyebrow={`${isEvent ? "Event" : "Workshop"} ticket confirmed`}
        title={firstName ? `You're on the list, ${firstName}!` : "You're on the list!"}
        text={`Your seat is reserved and paid for. Ticket #${result.ref}.`}
      />

      <DetailCard title={`Your ticket · #${result.ref}`}>
        {booking ? (
          <>
            <DetailRow k={isEvent ? "Event" : "Workshop"} v={booking.detail} />
            <DetailRow k="Date" v={booking.period} />
            <DetailRow k="Location" v={booking.location} />
            {booking.mode && (
              <DetailRow
                k="Format"
                v={<Badge tone="info">{booking.mode === "online" ? "💻 Online" : "🏃 In-Person"}</Badge>}
              />
            )}
            {booking.discountCode && (
              <DetailRow k={`Discount (${booking.discountCode})`} v={`− ${sek(booking.baseAmount - booking.amount)}`} />
            )}
          </>
        ) : null}
        <DetailRow k="Paid with" v={methodLabel(check.method)} />
        <DetailRow k="Amount paid" v={<span className="text-ok">✓ {sek(check.amount)}</span>} strong />
      </DetailCard>

      <NextSteps
        steps={[
          `Your ticket is saved in My Portal — show your ticket number (#${result.ref}) at check-in.`,
          booking?.mode === "online"
            ? `The joining link is emailed to ${booking?.email ?? "you"} before the ${what} starts.`
            : `Arrive 10 minutes early so the ${what} can start on time.`,
          `Can't make it? Contact the studio as soon as possible so your seat can go to someone else.`,
        ]}
      />

      <Actions>
        <LinkButton href="/portal">View my ticket →</LinkButton>
        <LinkButton href="/book/workshops" variant="secondary">
          Browse more workshops
        </LinkButton>
      </Actions>
    </>
  );
}
