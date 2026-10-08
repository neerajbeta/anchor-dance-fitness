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
  VatDetailRow,
} from "@/components/payments/ResultParts";

/** Studio Hire — payment started but not confirmed yet. Keeps checking by itself. */
export default function StudioPaymentPendingPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <StudioPaymentPending />
      </Suspense>
    </ResultLayout>
  );
}

function StudioPaymentPending() {
  const result = usePaymentResult("studio", "pending");
  if (result.status !== "pending" && result.status !== "stalled") {
    return <ResultGate result={result} checkingText="Checking your studio payment…" />;
  }
  const stalled = result.status === "stalled";

  return (
    <>
      <ResultHero
        tone="warn"
        icon="🕒"
        pulse={!stalled}
        eyebrow="Studio hire"
        title={stalled ? "Your slot is waiting on payment" : "Holding your studio slot…"}
        text={
          stalled
            ? "We still haven't had payment confirmation. If it doesn't come through, the slot is released for others to book."
            : "We're holding the slot for 15 minutes while your payment is confirmed. Keep this page open."
        }
      />

      <DetailCard title={`Studio booking · #${result.ref}`}>
        <DetailRow k="Status" v={<span className="font-semibold text-warn">Slot held — awaiting payment</span>} />
        <DetailRow k="Paying with" v={methodLabel(result.check?.method)} />
        <VatDetailRow check={result.check} />
        <DetailRow k="Amount" v={sek(result.check?.amount ?? 0)} strong />
      </DetailCard>

      <NextSteps
        title="Good to know"
        steps={[
          "Please don't book the slot again — that could charge you twice.",
          result.check?.method === "swish"
            ? "If you haven't yet, open Swish on your phone and approve the request."
            : "Card payments usually confirm within a minute.",
          "The slot is only yours once the payment is confirmed.",
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
