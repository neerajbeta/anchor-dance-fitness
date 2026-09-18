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
} from "@/components/payments/ResultParts";

/** Workshop / event booking — payment started but not confirmed yet. Keeps checking by itself. */
export default function WorkshopPaymentPendingPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <WorkshopPaymentPending />
      </Suspense>
    </ResultLayout>
  );
}

function WorkshopPaymentPending() {
  const result = usePaymentResult("workshop", "pending");
  if (result.status !== "pending" && result.status !== "stalled") {
    return <ResultGate result={result} checkingText="Checking your ticket payment…" />;
  }
  const stalled = result.status === "stalled";
  const what = result.check?.type === "event" ? "event" : "workshop";

  return (
    <>
      <ResultHero
        tone="warn"
        icon="🎫"
        pulse={!stalled}
        eyebrow={`${what === "event" ? "Event" : "Workshop"} ticket`}
        title={stalled ? "Your ticket is waiting on payment" : "Securing your seat…"}
        text={
          stalled
            ? `We haven't had payment confirmation yet. Your ${what} ticket will appear in My Portal as soon as it clears.`
            : "We're confirming your payment. Keep this page open — your ticket appears the moment it's through."
        }
      />

      <DetailCard title={`Ticket · #${result.ref}`}>
        <DetailRow k="Status" v={<span className="font-semibold text-warn">Awaiting payment confirmation</span>} />
        <DetailRow k="Paying with" v={methodLabel(result.check?.method)} />
        <DetailRow k="Amount" v={sek(result.check?.amount ?? 0)} strong />
      </DetailCard>

      <NextSteps
        title="Good to know"
        steps={[
          "Please don't buy the ticket again — that could charge you twice.",
          result.check?.method === "swish"
            ? "If you haven't yet, open Swish on your phone and approve the request."
            : "Card payments usually confirm within a minute.",
          `Seats for popular ${what}s go fast — your seat is only guaranteed once payment is confirmed.`,
        ]}
      />

      <Actions>
        <LinkButton href="/portal" variant="secondary">
          Go to My Portal
        </LinkButton>
      </Actions>
    </>
  );
}
