"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

// Themed date picker used instead of the browser's native <input type="date">,
// which looks different in every browser and can't match the design. Values are
// ISO dates ("2026-09-18") in and out, exactly like the native input.

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : null);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const label = (iso: string) =>
  fromIso(iso)!.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Form field name — a hidden input carries the value so FormData / `required` keep working. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Weekday labels ("Mon", "Wed"…) to mark with a dot, e.g. the days a class runs. */
  markWeekdays?: Set<string>;
  /** Month/year dropdowns in the header — for dates far away, like a date of birth. */
  yearRange?: [number, number];
  /** Calendar month shown first when nothing is selected (ISO date). */
  initialMonth?: string;
  clearable?: boolean;
  id?: string;
  /**
   * "admin" matches the admin panel's form fields and always renders light,
   * since the admin panel has no dark mode.
   */
  variant?: "portal" | "admin";
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
  name,
  required,
  disabled,
  markWeekdays,
  yearRange,
  initialMonth,
  clearable,
  id,
  variant = "portal",
}: DatePickerProps) {
  const admin = variant === "admin";
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // The calendar renders in a portal on <body>: fields often sit inside a <label>,
  // and a click inside the calendar would otherwise re-trigger the label's button.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const today = toIso(new Date());
  const startMonth = () => {
    const base = fromIso(value) ?? fromIso(initialMonth) ?? fromIso(min && min > today ? min : null) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  };
  const [month, setMonth] = useState(startMonth);
  // The day keyboard focus sits on inside the grid.
  const [cursor, setCursor] = useState<string>(value || (min && min > today ? min : today));

  const outOfRange = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  // Re-open on the selected month.
  useEffect(() => {
    if (!open) return;
    setMonth(startMonth());
    setCursor(value || (min && min > today ? min : today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Place the calendar under the field (or above it when there's no room), and
  // follow it while the page scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(300, window.innerWidth - 32);
      const height = popRef.current?.offsetHeight ?? 360;
      const below = r.bottom + 6 + height <= window.innerHeight || r.top < height + 6;
      setPos({
        top: below ? r.bottom + 6 : r.top - height - 6,
        left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, month]);

  // Keep keyboard focus on the cursor day.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)?.focus();
  }, [open, cursor, month]);

  // 6 weeks, Monday first.
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const minMonth = fromIso(min);
  const maxMonth = fromIso(max);
  const canPrev = !minMonth || addMonths(month, -1) >= new Date(minMonth.getFullYear(), minMonth.getMonth(), 1);
  const canNext = !maxMonth || addMonths(month, 1) <= new Date(maxMonth.getFullYear(), maxMonth.getMonth(), 1);

  function pick(iso: string) {
    if (outOfRange(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  function moveCursor(byDays: number, byMonths = 0) {
    const from = fromIso(cursor) ?? new Date();
    const next = byMonths
      ? new Date(from.getFullYear(), from.getMonth() + byMonths, Math.min(from.getDate(), 28))
      : addDays(from, byDays);
    const iso = toIso(next);
    setCursor(iso);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function onGridKey(e: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => moveCursor(-1),
      ArrowRight: () => moveCursor(1),
      ArrowUp: () => moveCursor(-7),
      ArrowDown: () => moveCursor(7),
      PageUp: () => moveCursor(0, -1),
      PageDown: () => moveCursor(0, 1),
      Enter: () => pick(cursor),
      " ": () => pick(cursor),
      Escape: () => setOpen(false),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  }

  const years = yearRange
    ? Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[1] - i)
    : [];

  return (
    <div ref={rootRef} className={cn("relative", admin && "force-light")}>
      <button
        type="button"
        id={fieldId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          admin
            ? "field flex items-center gap-2.5 text-left"
            : "premium-input flex h-12 w-full items-center gap-2.5 rounded-[12px] border border-hairline bg-surface-muted/60 px-4 text-left text-sm transition focus:border-accent focus:bg-surface focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          open && (admin ? "border-brand-400" : "border-accent bg-surface"),
        )}
      >
        <CalendarDays className={cn("h-[18px] w-[18px] shrink-0", value ? "text-accent" : "text-copy-dim")} />
        <span className={cn("flex-1 truncate", value ? "text-copy" : "text-copy-dim/70")}>
          {value ? label(value) : placeholder}
        </span>
        {clearable && value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }
            }}
            className="rounded-full p-0.5 text-copy-dim hover:bg-surface-muted hover:text-copy"
          >
            <X className="h-4 w-4" />
          </span>
        ) : null}
      </button>

      {/* Carries the value into plain HTML forms and lets `required` block submit. */}
      {name || required ? (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          onFocus={() => setOpen(true)}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      ) : null}

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose a date"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className={cn(admin && "force-light", "animate-sheet fixed z-[80] w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-hairline bg-surface p-3 shadow-[var(--shadow-lg)]")}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              disabled={!canPrev}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-copy transition hover:bg-surface-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {yearRange ? (
              <div className="flex gap-1">
                <select
                  aria-label="Month"
                  value={month.getMonth()}
                  onChange={(e) => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1))}
                  className="rounded-lg border border-hairline bg-surface px-1.5 py-1 text-[13px] font-semibold text-copy"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>
                      {m.slice(0, 3)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Year"
                  value={month.getFullYear()}
                  onChange={(e) => setMonth(new Date(Number(e.target.value), month.getMonth(), 1))}
                  className="rounded-lg border border-hairline bg-surface px-1.5 py-1 text-[13px] font-semibold text-copy"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-sm font-bold text-copy">
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              disabled={!canNext}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-full text-copy transition hover:bg-surface-muted disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wide text-copy-dim">
            {WEEK.map((w) => (
              <div key={w} className="py-1">
                {w.slice(0, 2)}
              </div>
            ))}
          </div>

          <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const iso = toIso(d);
              const inMonth = d.getMonth() === month.getMonth();
              const selected = iso === value;
              const blocked = outOfRange(iso);
              const marked = markWeekdays?.has(WEEK[(d.getDay() + 6) % 7]) && !blocked;
              return (
                <button
                  key={iso}
                  type="button"
                  data-iso={iso}
                  tabIndex={iso === cursor ? 0 : -1}
                  disabled={blocked}
                  onClick={() => pick(iso)}
                  aria-label={label(iso)}
                  aria-selected={selected}
                  className={cn(
                    "relative flex h-9 items-center justify-center rounded-lg text-[13px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                    !inMonth && "text-copy-dim/40",
                    inMonth && !selected && !blocked && "text-copy hover:bg-accent/10",
                    blocked && "cursor-not-allowed text-copy-dim/30 line-through decoration-copy-dim/20",
                    iso === today && !selected && "font-bold text-accent",
                    selected && "brand-gradient font-bold text-white shadow-[0_6px_14px_rgba(235,57,54,0.3)]",
                  )}
                >
                  {d.getDate()}
                  {marked && !selected ? (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-[12px]">
            {markWeekdays?.size ? (
              <span className="inline-flex items-center gap-1.5 text-copy-dim">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Class days
              </span>
            ) : (
              <span />
            )}
            {!outOfRange(today) ? (
              <button type="button" onClick={() => pick(today)} className="font-semibold text-accent hover:underline">
                Today
              </button>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

/**
 * For plain HTML forms read with FormData: keeps its own value, starting from
 * `defaultValue`, like an uncontrolled `<input type="date" defaultValue>`.
 * Give it a `key` that changes with the record being edited so it resets.
 */
export function FormDatePicker({
  defaultValue,
  ...props
}: Omit<DatePickerProps, "value" | "onChange"> & { name: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  return <DatePicker {...props} value={value} onChange={setValue} clearable={props.clearable ?? !props.required} />;
}
