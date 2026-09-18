"use client";

import { Suspense } from "react";
import { LinkButton } from "@/components/theme/LinkButton";
import { usePaymentResult } from "@/components/payments/usePaymentResult";
import { Actions, NextSteps, ResultGate, ResultHero, ResultLayout } from "@/components/payments/ResultParts";

/** Studio Hire — payment cancelled, declined or expired; the held slot is released. */
export default function StudioPaymentCancelledPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <StudioPaymentCancelled />
      </Suspense>
    </ResultLayout>
  );
}

function StudioPaymentCancelled() {
  const result = usePaymentResult("studio", "cancelled");
  if (result.status !== "cancelled") return <ResultGate result={result} checkingText="Checking your studio payment…" />;

  return (
    <>
      <ResultHero
        tone="danger"
        icon="✕"
        eyebrow="Studio hire"
        title="Studio not booked"
        text={`The payment for booking #${result.ref} wasn't completed, so you haven't been charged and the slot has been released.`}
      />

      <NextSteps
        title="What you can do"
        steps={[
          "Go back to Studio Hire and pick your date and time again.",
          "Someone else may book the slot in the meantime — check availability on the calendar.",
          "You can switch between card and Swish when you pay.",
        ]}
      />

      <Actions>
        <LinkButton href="/book/studio">Book the studio again →</LinkButton>
        <LinkButton href="/portal" variant="secondary">
          Go to My Portal
        </LinkButton>
      </Actions>
    </>
  );
}
