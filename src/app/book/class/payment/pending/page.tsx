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

/** Class booking — payment started but not confirmed yet. Keeps checking by itself. */
export default function ClassPaymentPendingPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <ClassPaymentPending />
      </Suspense>
    </ResultLayout>
  );
}

function ClassPaymentPending() {
  const result = usePaymentResult("class", "pending");
  if (result.status !== "pending" && result.status !== "stalled") {
    return <ResultGate result={result} checkingText="Checking your class payment…" />;
  }
  const stalled = result.status === "stalled";

  return (
    <>
      <ResultHero
        tone="warn"
        icon="⏳"
        pulse={!stalled}
        eyebrow="Class booking"
        title={stalled ? "Still waiting on your bank" : "Confirming your payment…"}
        text={
          stalled
            ? "We haven't had confirmation yet. Your place is saved — it will update in My Portal as soon as the payment clears."
            : "This can take a minute. Keep this page open — it moves on by itself once the payment is confirmed."
        }
      />

      <DetailCard title={`Class booking · #${result.ref}`}>
        <DetailRow k="Status" v={<span className="font-semibold text-warn">Awaiting payment confirmation</span>} />
        <DetailRow k="Paying with" v={methodLabel(result.check?.method)} />
        <DetailRow k="Amount" v={sek(result.check?.amount ?? 0)} strong />
      </DetailCard>

      <NextSteps
        title="Good to know"
        steps={[
          "Please don't pay again — that could charge you twice.",
          result.check?.method === "swish"
            ? "If you haven't yet, open Swish on your phone and approve the request."
            : "Card payments usually confirm within a minute.",
          "If the payment fails, you'll be taken to a page to try again.",
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
