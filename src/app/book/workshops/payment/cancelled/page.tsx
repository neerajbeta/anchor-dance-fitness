"use client";

import { Suspense } from "react";
import { LinkButton } from "@/components/theme/LinkButton";
import { usePaymentResult } from "@/components/payments/usePaymentResult";
import { Actions, NextSteps, ResultGate, ResultHero, ResultLayout } from "@/components/payments/ResultParts";

/** Workshop / event booking — payment cancelled, declined or expired. */
export default function WorkshopPaymentCancelledPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <WorkshopPaymentCancelled />
      </Suspense>
    </ResultLayout>
  );
}

function WorkshopPaymentCancelled() {
  const result = usePaymentResult("workshop", "cancelled");
  if (result.status !== "cancelled") return <ResultGate result={result} checkingText="Checking your ticket payment…" />;
  const what = result.check?.type === "event" ? "event" : "workshop";

  return (
    <>
      <ResultHero
        tone="danger"
        icon="✕"
        eyebrow={`${what === "event" ? "Event" : "Workshop"} ticket`}
        title="Ticket not booked"
        text={`The payment for ticket #${result.ref} wasn't completed, so you haven't been charged and no seat was reserved.`}
      />

      <NextSteps
        title="What you can do"
        steps={[
          `Your ${what} is still selected — you can pay again straight away.`,
          "You can switch between card and Swish on the payment page.",
          `Seats are limited, so book again soon if you still want to join.`,
        ]}
      />

      <Actions>
        <LinkButton href="/plans">Try payment again →</LinkButton>
        <LinkButton href="/book/workshops" variant="secondary">
          Browse workshops & events
        </LinkButton>
      </Actions>
    </>
  );
}
