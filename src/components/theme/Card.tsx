import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card p-5 md:p-7", className)} {...props} />;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("font-display text-base font-bold tracking-tight text-copy", className)}>
      {children}
    </h3>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "purple";

const tones: Record<Tone, string> = {
  neutral: "bg-[#F3EEE9] text-[#5A534C] dark:bg-white/10 dark:text-white/70",
  success: "bg-[#E6F6EE] text-[#156B45] dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-[#FFF3DD] text-[#8A5600] dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-[#FDECEC] text-[#B42318] dark:bg-red-500/15 dark:text-red-300",
  info: "bg-[#EAF1FB] text-[#1A4E9C] dark:bg-sky-500/15 dark:text-sky-300",
  brand: "bg-[#FDECEC] text-[#C92C2A] dark:bg-accent/15 dark:text-accent-warm",
  purple: "bg-[#F5EDFF] text-[#6B21A8] dark:bg-violet-500/15 dark:text-violet-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
