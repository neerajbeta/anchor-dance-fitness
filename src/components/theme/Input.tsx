import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base =
  "premium-input w-full rounded-[12px] border border-hairline bg-surface-muted/60 text-sm text-copy transition placeholder:text-copy-dim/60 focus:border-accent focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-copy-dim";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-12 px-4", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "h-12 px-4", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "px-4 py-3.5", className)} {...props} />;
}
