"use client";

import { Suspense } from "react";
import { LinkButton } from "@/components/theme/LinkButton";
import { usePaymentResult } from "@/components/payments/usePaymentResult";
import { Actions, NextSteps, ResultGate, ResultHero, ResultLayout } from "@/components/payments/ResultParts";

/** Class booking — payment cancelled, declined or expired. */
export default function ClassPaymentCancelledPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <ClassPaymentCancelled />
      </Suspense>
    </ResultLayout>
  );
}

function ClassPaymentCancelled() {
  const result = usePaymentResult("class", "cancelled");
  if (result.status !== "cancelled") return <ResultGate result={result} checkingText="Checking your class payment…" />;

  return (
    <>
      <ResultHero
        tone="danger"
        icon="✕"
        eyebrow="Class booking"
        title="Payment not completed"
        text={`Your class booking #${result.ref} wasn't paid, so you haven't been charged and you're not enrolled yet.`}
      />

      <NextSteps
        title="What you can do"
        steps={[
          "Your class and dates are still saved — just pick a plan and pay again.",
          "You can switch between card and Swish on the payment page.",
          "Changed your mind about the class? Choose a different one.",
        ]}
      />

      <Actions>
        <LinkButton href="/plans">Try payment again →</LinkButton>
        <LinkButton href="/book/class" variant="secondary">
          Choose a different class
        </LinkButton>
      </Actions>
    </>
  );
}
