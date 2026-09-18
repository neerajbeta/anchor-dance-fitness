import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#EB3936_0%,#F16935_55%,#F89B47_100%)] text-white shadow-[0_10px_28px_rgba(235,57,54,0.32)] hover:-translate-y-0.5",
  secondary:
    "border border-hairline bg-surface text-copy hover:border-accent/40 hover:text-accent",
  dark: "bg-chrome text-white hover:bg-chrome-deep hover:-translate-y-0.5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold no-underline transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}
