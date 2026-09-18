import { cn } from "@/lib/cn";
import { Calendar, Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-hairline bg-surface px-6 py-16 text-center shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted">
        {icon ?? <Inbox className="h-6 w-6 text-copy-dim" />}
      </div>
      <h3 className="font-display text-lg font-semibold text-copy">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-copy-dim">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={label}>
      <div className="h-28 animate-pulse rounded-[18px] bg-surface-muted" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-36 animate-pulse rounded-[18px] bg-surface-muted" />
        <div className="h-36 animate-pulse rounded-[18px] bg-surface-muted" />
        <div className="h-36 animate-pulse rounded-[18px] bg-surface-muted" />
      </div>
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-red-200/80 bg-red-50/90 p-4 text-danger shadow-[var(--shadow-sm)] dark:border-red-900 dark:bg-red-950/40">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-display text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}

export function InfoBanner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "success";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border px-4 py-3.5 text-sm leading-6",
        tone === "info" && "border-sky-200/80 bg-sky-50/90 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
        tone === "warning" && "border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
        tone === "success" && "border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 h-1 w-10 rounded-full brand-gradient" />
        <h1 className="font-oswald text-3xl font-semibold italic tracking-tight text-copy md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-copy-dim md:text-[15px]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CalendarHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-copy-dim">
      <Calendar className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}
