"use client";

import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Progress header for multi-step flows: a "Step 2 of 3" card with a filling
 * progress bar, and a row of step badges (icons when given, numbers otherwise).
 * On phones only the current step's label is shown so the row never wraps.
 */
export function Stepper({
  steps,
  current,
  icons,
  subtitle,
}: {
  steps: string[];
  current: number;
  icons?: LucideIcon[];
  /** One line under the step title, e.g. what the customer does on this step. */
  subtitle?: string;
}) {
  const progress = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;

  return (
    <div className="surface-card relative mb-7 overflow-hidden p-5 md:p-6">
      {/* soft brand glow behind the header */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
            Step {Math.min(current + 1, steps.length)} of {steps.length}
          </div>
          <h1 className="mt-1 font-oswald text-2xl font-bold italic leading-tight text-copy md:text-[28px]">
            {steps[current]}
          </h1>
          {subtitle ? <p className="mt-1 text-[13px] text-copy-dim">{subtitle}</p> : null}
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="font-oswald text-3xl font-bold leading-none text-copy">
            {Math.min(current + 1, steps.length)}
            <span className="text-lg text-copy-dim">/{steps.length}</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-copy-dim">steps</div>
        </div>
      </div>

      <ol className="relative flex items-start">
        {/* track + animated fill, running between the first and last badge centres */}
        <div className="absolute left-5 right-5 top-5 h-1 -translate-y-1/2 rounded-full bg-hairline" aria-hidden>
          <div
            className="brand-gradient h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {steps.map((label, index) => {
          const state = index < current ? "done" : index === current ? "active" : "todo";
          const Icon = icons?.[index];
          const align =
            index === 0 ? "items-start text-left" : index === steps.length - 1 ? "items-end text-right" : "items-center text-center";
          return (
            <li
              key={label}
              className={cn("relative flex flex-1 flex-col", align)}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className="relative flex h-10 w-10 items-center justify-center">
                {state === "active" ? (
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-4 ring-surface transition-all duration-300",
                    state === "done" && "brand-gradient text-white shadow-[0_6px_16px_rgba(235,57,54,0.3)]",
                    state === "active" && "brand-gradient scale-110 text-white shadow-[0_10px_24px_rgba(235,57,54,0.38)]",
                    state === "todo" && "border-2 border-hairline bg-surface text-copy-dim",
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : Icon ? (
                    <Icon className="h-[18px] w-[18px]" />
                  ) : (
                    index + 1
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "mt-2.5 text-[12px] font-semibold leading-tight",
                  state === "active" ? "text-copy" : "hidden text-copy-dim sm:block",
                  state === "done" && "sm:text-copy",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ModeToggle({
  value,
  onChange,
  onlineLabel = "Online",
  offlineLabel = "In-Person",
}: {
  value: "online" | "in-person";
  onChange: (value: "online" | "in-person") => void;
  onlineLabel?: string;
  offlineLabel?: string;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-hairline bg-surface p-1 shadow-[var(--shadow-sm)]">
      {(["online", "in-person"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            value === mode ? "bg-chrome text-white" : "text-copy-dim hover:text-copy",
          )}
        >
          {mode === "online" ? onlineLabel : offlineLabel}
        </button>
      ))}
    </div>
  );
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
            value === option.id
              ? "border-chrome bg-chrome text-white shadow-[0_6px_14px_rgba(20,17,16,0.15)]"
              : "border-hairline bg-surface text-copy-dim hover:border-accent hover:text-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
