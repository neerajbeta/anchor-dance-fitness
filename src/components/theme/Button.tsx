import { cn } from "@/lib/cn";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#EB3936_0%,#F16935_55%,#F89B47_100%)] text-white shadow-[0_10px_28px_rgba(235,57,54,0.32)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(235,57,54,0.38)] active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0",
  secondary:
    "border border-hairline bg-surface text-copy shadow-[0_1px_2px_rgba(20,17,16,0.04)] hover:border-accent/40 hover:text-accent hover:shadow-[0_8px_20px_rgba(20,17,16,0.06)]",
  ghost: "bg-transparent text-copy-dim hover:bg-surface-muted hover:text-copy",
  danger:
    "border border-red-200/80 bg-red-50/90 text-danger hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:hover:bg-red-950",
  dark: "bg-chrome text-white shadow-[0_8px_24px_rgba(20,17,16,0.25)] hover:bg-chrome-deep hover:-translate-y-0.5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs tracking-wide",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
