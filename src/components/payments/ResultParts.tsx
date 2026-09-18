"use client";

import type { ReactNode } from "react";
import { SessionStudentNav } from "@/components/theme/shells";
import { LinkButton } from "@/components/theme/LinkButton";
import { cn } from "@/lib/cn";
import type { PaymentResult } from "./usePaymentResult";

// Building blocks for the payment result pages. Each booking type's page
// composes these with its own wording and next steps.

export function ResultLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />
      <main className="animate-enter mx-auto w-full max-w-xl px-4 py-12 pb-24">{children}</main>
    </div>
  );
}

/** Spinner while checking, or the error — returns null once there's something to show. */
export function ResultGate({ result, checkingText }: { result: PaymentResult; checkingText: string }) {
  if (result.status === "checking") {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-hairline border-t-accent" />
        <p className="text-sm text-copy-dim">{checkingText}</p>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <>
        <ResultHero tone="warn" icon="⚠️" title="We couldn't check this payment" text={result.error ?? ""} />
        <Actions>
          <LinkButton href="/portal">Go to My Portal →</LinkButton>
        </Actions>
      </>
    );
  }
  return null;
}

const TONES = {
  ok: "from-ok/20 to-ok/5 text-ok",
  warn: "from-warn/25 to-warn/5 text-warn",
  danger: "from-danger/20 to-danger/5 text-danger",
  accent: "from-accent/20 to-accent/5 text-accent",
};

export function ResultHero({
  tone,
  icon,
  eyebrow,
  title,
  text,
  pulse,
}: {
  tone: keyof typeof TONES;
  icon: string;
  eyebrow?: string;
  title: string;
  text: ReactNode;
  pulse?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b text-4xl",
          TONES[tone],
          pulse && "animate-pulse",
        )}
      >
        {icon}
      </div>
      {eyebrow ? (
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-copy-dim">{eyebrow}</div>
      ) : null}
      <h1 className="font-oswald text-[28px] font-extrabold italic leading-tight text-copy">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-copy-dim">{text}</p>
    </div>
  );
}

export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-5 rounded-[18px] border border-hairline bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-copy-dim">{title}</div>
      {children}
    </div>
  );
}

export function DetailRow({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-hairline py-1.5 text-[13px] last:border-0">
      <span className="text-copy-dim">{k}</span>
      <span className={cn("text-right text-copy", strong ? "font-bold" : "font-medium")}>{v}</span>
    </div>
  );
}

/** Numbered "what happens next" list. */
export function NextSteps({ title = "What happens next", steps }: { title?: string; steps: ReactNode[] }) {
  return (
    <div className="mb-6 rounded-[18px] border border-hairline bg-surface-muted/40 p-5">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-copy-dim">{title}</div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[13px] text-copy">
            <span className="brand-gradient flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>;
}

export const methodLabel = (m: "stripe" | "swish" | null | undefined) =>
  m === "swish" ? "Swish" : m === "stripe" ? "Card (Stripe)" : "—";

export const sek = (n: number) => `SEK ${n.toLocaleString()}`;
