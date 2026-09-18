"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export function ThemeToggle({
  className,
  tone = "on-dark",
  showLabel = true,
}: {
  className?: string;
  tone?: "on-dark" | "on-light" | "brand";
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold tracking-wide transition",
        tone === "on-dark" && "border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25",
        tone === "on-light" &&
          "border-hairline bg-surface text-copy shadow-sm hover:border-accent/50 hover:text-accent",
        tone === "brand" &&
          "border-accent/30 bg-accent text-white shadow-[0_8px_20px_rgba(235,57,54,0.35)] hover:bg-accent-dark",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel ? <span>{isDark ? "Light" : "Dark"}</span> : null}
    </button>
  );
}

/** Always-visible floating control so the theme switch is never missed. */
export function ThemeToggleFab() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed bottom-20 right-4 z-[90] inline-flex h-12 items-center gap-2 rounded-full border border-accent-warm/40 bg-[#2a211c] px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(27,21,18,0.45)] transition hover:-translate-y-0.5 hover:bg-accent md:bottom-6 md:right-6"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-accent-warm" />
      ) : (
        <Moon className="h-4 w-4 text-accent-warm" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
