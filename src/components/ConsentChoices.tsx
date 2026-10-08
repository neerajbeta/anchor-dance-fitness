"use client";

import { cn } from "@/lib/cn";
import {
  CONSENT_ITEMS,
  CONSENT_NOTE,
  CONSENT_TITLE,
  EMPTY_CONSENT,
  type ConsentChoices as Choices,
  type ConsentKey,
} from "@/lib/consent";

export type { Choices as ConsentChoicesValue };

export const EMPTY_CHOICES = EMPTY_CONSENT;

/**
 * The GDPR consent block: one checkbox per permission (contact & booking
 * details, photos, videos, promotional use) so it is always clear what was
 * agreed to. Used on signup, on the class booking step and at checkout.
 */
export function ConsentChoices({
  value,
  onChange,
  variant = "self",
  className,
}: {
  value: Choices;
  onChange: (next: Choices) => void;
  /** "member" words each line for a parent agreeing on a child's behalf. */
  variant?: "self" | "member";
  className?: string;
}) {
  function toggle(key: ConsentKey) {
    const next = { ...value, [key]: !value[key] };
    // Promotional use only means something with a photo or video to use.
    if ((key === "photo" || key === "video") && !next.photo && !next.video) next.promo = false;
    if (key === "promo" && next.promo && !next.photo && !next.video) {
      next.photo = true;
      next.video = true;
    }
    onChange(next);
  }

  return (
    <div
      className={cn(
        "mb-5 rounded-[16px] border-2 border-amber-300/90 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/30",
        className,
      )}
    >
      <div className="font-display text-sm font-semibold text-copy">{CONSENT_TITLE}</div>

      <div className="mt-3 space-y-2.5">
        {CONSENT_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.key)}
            aria-pressed={value[item.key]}
            className="flex w-full items-start gap-3 rounded-[12px] border border-amber-300/70 bg-surface/70 p-3 text-left transition hover:border-amber-400 dark:border-amber-900"
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[11px]",
                value[item.key] ? "border-transparent brand-gradient text-white" : "border-amber-500 bg-white",
              )}
              aria-hidden
            >
              {value[item.key] ? "✓" : ""}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-copy">
                {item.title}
                {item.required ? <span className="text-danger"> *</span> : <span className="text-copy-dim"> · optional</span>}
              </span>
              <span className="mt-0.5 block text-[13px] leading-6 text-copy-dim">
                {variant === "member" ? item.memberText : item.text}
              </span>
              <span className="mt-0.5 block text-[11px] leading-5 text-copy-dim">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-copy-dim">{CONSENT_NOTE}</p>
      <p className="mt-1 text-[11px] font-bold text-danger">* Required to continue.</p>
    </div>
  );
}
