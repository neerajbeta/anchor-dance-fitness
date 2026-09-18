import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function FormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1.5 block text-[11px] text-copy-dim">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-[12px] text-danger">{error}</span> : null}
    </label>
  );
}

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-6 rounded-[18px] border border-hairline bg-surface p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <h3 className="mb-4 font-display text-sm font-bold tracking-tight text-copy">{title}</h3>
      {children}
    </section>
  );
}

export function ConsentCheckbox({
  checked,
  onChange,
  title,
  children,
  tone = "warning",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  children: ReactNode;
  tone?: "warning" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "mb-5 flex w-full items-start gap-3 rounded-[16px] border-2 p-4 text-left transition",
        tone === "warning"
          ? "border-amber-300/90 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-red-200 bg-red-50/90 dark:border-red-900 dark:bg-red-950/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px]",
          checked ? "border-transparent brand-gradient text-white" : "border-amber-500 bg-white",
        )}
        aria-hidden
      >
        {checked ? "✓" : ""}
      </span>
      <span>
        <span className="block font-display text-sm font-semibold text-copy">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-copy-dim">{children}</span>
      </span>
    </button>
  );
}
