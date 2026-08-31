"use client";

import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type StudioBlockRange = {
  location: string;
  date: string; // YYYY-MM-DD
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};

export type StudioBookingMark = {
  name: string;
  location: string;
  date: string; // YYYY-MM-DD
  when: string; // display detail — time range + purpose
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * A real, navigable month calendar (no hardcoded month/year) that marks days
 * covered by admin-created studio blocks, and (when passed) actual studio
 * bookings — e.g. from "Book Studio on Behalf", which carries a real date.
 * Pass `selected` + `onSelect` to make date picking interactive; omit them
 * for a read-only admin overview.
 */
export function StudioCalendar({
  blocks = [],
  bookings = [],
  locationFilter,
  adminView = false,
  selected,
  onSelect,
  initialMonth,
}: {
  blocks?: StudioBlockRange[];
  bookings?: StudioBookingMark[];
  locationFilter?: string;
  adminView?: boolean;
  selected?: string;
  onSelect?: (dateStr: string) => void;
  initialMonth?: string; // YYYY-MM-DD — which month to open on
}) {
  const initial = initialMonth ? new Date(initialMonth) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const relevantBlocks = locationFilter
    ? blocks.filter((b) => b.location === locationFilter)
    : blocks;
  const relevantBookings = locationFilter
    ? bookings.filter((b) => b.location === locationFilter)
    : bookings;

  function blocksOn(dateStr: string) {
    return relevantBlocks.filter((b) => b.date <= dateStr && (b.endDate || b.date) >= dateStr);
  }
  function bookingsOn(dateStr: string) {
    return relevantBookings.filter((b) => b.date === dateStr);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const today = new Date();
  const todayStr = isoOf(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 42; i++) {
    if (i < firstDay) {
      cells.push(
        <div key={`p${i}`} className="min-h-[64px] rounded-lg bg-cream/60 p-1.5">
          <div className="text-[13px] font-bold text-line">{prevMonthDays - (firstDay - i - 1)}</div>
        </div>
      );
    } else if (i - firstDay + 1 <= daysInMonth) {
      const day = i - firstDay + 1;
      const dateStr = isoOf(viewYear, viewMonth, day);
      const dayBlocks = blocksOn(dateStr);
      const dayBookings = bookingsOn(dateStr);
      const block = dayBlocks[0];
      const isSel = selected === dateStr;
      const isToday = dateStr === todayStr;
      const clickable = !block && !!onSelect;
      const hasMarkers = dayBlocks.length > 0 || dayBookings.length > 0;
      const rowIndex = Math.floor(i / 7);
      const openUpward = rowIndex >= 4;
      cells.push(
        <div key={day} className="group relative">
          <button
            type="button"
            disabled={!!block}
            onClick={() => clickable && onSelect?.(dateStr)}
            className={`min-h-[64px] w-full rounded-lg border-[1.5px] p-1.5 text-left text-xs transition-all ${
              block
                ? "cursor-not-allowed border-dashed border-line bg-cream/60"
                : isSel
                ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
                : clickable
                ? "border-line bg-white hover:border-brand-400 hover:bg-brand-50"
                : "border-line bg-white"
            }`}
          >
            <div className={`mb-1 text-[13px] font-bold ${isToday ? "text-brand-600" : "text-ink"}`}>
              {day}
            </div>
            {dayBookings.map((b, idx) => (
              <div
                key={`bk${idx}`}
                className="mb-0.5 truncate rounded bg-grape/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#5b3ba8] last:mb-0"
              >
                🟣 {b.name}
              </div>
            ))}
            {dayBlocks.map((b, idx) => (
              <div
                key={`bl${idx}`}
                className="mb-0.5 truncate rounded bg-cream-deep px-1.5 py-0.5 text-[10px] font-semibold text-muted last:mb-0"
              >
                🚫 {(b.startTime ?? "").slice(0, 5)}–{(b.endTime ?? "").slice(0, 5)}
              </div>
            ))}
          </button>

          {hasMarkers && (
            <div
              className={`hidden absolute left-1/2 z-30 w-60 -translate-x-1/2 rounded-lg bg-ink p-3 text-left text-white shadow-pop group-hover:block ${
                openUpward ? "bottom-full mb-2" : "top-full mt-2"
              }`}
            >
              {dayBookings.map((b, idx) => (
                <div key={`bk${idx}`} className={idx > 0 ? "mt-2 border-t border-white/15 pt-2" : ""}>
                  <div className="text-[12px] font-bold">🟣 {b.name}</div>
                  <div className="text-[11px] text-white/70">{b.when}</div>
                  <div className="text-[11px] text-white/70">📍 {b.location}</div>
                </div>
              ))}
              {dayBookings.length > 0 && dayBlocks.length > 0 && (
                <div className="mt-2 border-t border-white/15 pt-2" />
              )}
              {dayBlocks.map((b, idx) => (
                <div key={`bl${idx}`} className={idx > 0 ? "mt-2 border-t border-white/15 pt-2" : ""}>
                  <div className="text-[12px] font-bold">
                    🚫 {(b.startTime ?? "").slice(0, 5)}–{(b.endTime ?? "").slice(0, 5)}
                  </div>
                  <div className="text-[11px] text-white/70">
                    📍 {b.location}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </div>
                  {b.endDate && b.endDate !== b.date && (
                    <div className="text-[11px] text-white/70">
                      {b.date} → {b.endDate}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      const n = i - firstDay - daysInMonth + 1;
      cells.push(
        <div key={`n${i}`} className="min-h-[64px] rounded-lg bg-cream/60 p-1.5">
          <div className="text-[13px] font-bold text-line">{n}</div>
        </div>
      );
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-line text-slate hover:border-brand-400 hover:text-brand-600"
        >
          ‹
        </button>
        <div className="text-sm font-bold text-ink">
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-line text-slate hover:border-brand-400 hover:text-brand-600"
        >
          ›
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-3.5 text-xs">
        {adminView ? (
          <>
            {bookings.length > 0 && <Legend color="rgba(139,92,246,0.25)" label="Studio Booked" />}
            <Legend color="#F4EEE6" label="Blocked" />
          </>
        ) : (
          <>
            <Legend color="#F4EEE6" label="Unavailable" />
            <Legend color="#fff" label="Available" border />
            <Legend color="#EF5B2B" label="Selected" />
          </>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[11px] font-bold uppercase text-muted">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded"
        style={{ background: color, border: border ? "1px solid #ECE4DA" : undefined }}
      />
      <span className="text-muted">{label}</span>
    </div>
  );
}
