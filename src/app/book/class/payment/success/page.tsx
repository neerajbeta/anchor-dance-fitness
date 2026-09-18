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

/** Class booking — payment confirmed. */
export default function ClassPaymentSuccessPage() {
  return (
    <ResultLayout>
      <Suspense fallback={null}>
        <ClassPaymentSuccess />
      </Suspense>
    </ResultLayout>
  );
}

function ClassPaymentSuccess() {
  const result = usePaymentResult("class", "success");
  const gate = <ResultGate result={result} checkingText="Confirming your class payment…" />;
  if (result.status !== "paid" || !result.check) return gate;

  const { booking, check } = result;
  const firstName = booking?.name.split(" ")[0];
  const online = booking?.mode === "online";

  return (
    <>
      <ResultHero
        tone="ok"
        icon="🎓"
        eyebrow="Class booking confirmed"
        title={firstName ? `You're enrolled, ${firstName}!` : "You're enrolled!"}
        text={`Payment received for booking #${result.ref}. See you on the dance floor!`}
      />

      <DetailCard title={`Class receipt · #${result.ref}`}>
        {booking ? (
          <>
            <DetailRow k="Class" v={booking.detail} />
            {booking.category && <DetailRow k="Style" v={booking.category} />}
            <DetailRow k="Course dates" v={booking.period} />
            <DetailRow k="Plan" v={booking.plan} />
            <DetailRow k="Studio" v={booking.location} />
            {booking.mode && (
              <DetailRow k="Mode" v={<Badge tone="info">{online ? "💻 Online" : "🏃 In-Person"}</Badge>} />
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
          "Our team assigns you to a batch within 24 hours.",
          online
            ? `A video-call link is emailed to ${booking?.email ?? "you"} before your first session.`
            : `Studio address and timings are emailed to ${booking?.email ?? "you"}.`,
          "Your class and receipt are always in My Portal.",
        ]}
      />

      <Actions>
        <LinkButton href="/portal">Go to My Portal →</LinkButton>
        <LinkButton href="/book/class" variant="secondary">
          Book another class
        </LinkButton>
      </Actions>
    </>
  );
}
