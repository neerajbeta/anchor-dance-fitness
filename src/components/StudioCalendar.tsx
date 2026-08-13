"use client";

import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalMarker = { tone: "studio" | "blocked"; label: string };

export function StudioCalendar({
  selectedDay = 7,
  adminView = false,
  events: EVENTS = {},
}: {
  selectedDay?: number;
  adminView?: boolean;
  events?: Record<number, CalMarker[]>;
}) {
  const [sel, setSel] = useState(selectedDay);
  const firstDay = new Date(2025, 7, 1).getDay();
  const daysInMonth = 31;
  const prevMonthDays = new Date(2025, 7, 0).getDate();
  const cells: React.ReactNode[] = [];

  for (let i = 0; i < 42; i++) {
    if (i < firstDay) {
      cells.push(
        <div key={`p${i}`} className="min-h-[72px] rounded-lg bg-cream/60 p-1.5">
          <div className="text-[13px] font-bold text-line">{prevMonthDays - (firstDay - i - 1)}</div>
        </div>
      );
    } else if (i - firstDay + 1 <= daysInMonth) {
      const day = i - firstDay + 1;
      const evs = EVENTS[day] || [];
      const blocked = evs.some((e) => e.tone === "blocked");
      const isSel = day === sel;
      cells.push(
        <button
          key={day}
          disabled={blocked}
          onClick={() => !blocked && setSel(day)}
          className={`min-h-[72px] rounded-lg border-[1.5px] p-1.5 text-left text-xs transition-all ${
            blocked
              ? "cursor-not-allowed border-line bg-cream/60"
              : isSel
              ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
              : "border-line bg-white hover:border-brand-400 hover:bg-brand-50"
          }`}
        >
          <div className="mb-1 text-[13px] font-bold text-ink">{day}</div>
          {evs.slice(0, 2).map((e, idx) => (
            <div
              key={idx}
              className={`mb-0.5 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                e.tone === "studio"
                  ? "bg-grape/15 text-[#5b3ba8]"
                  : "bg-cream-deep text-muted"
              }`}
            >
              {e.label}
            </div>
          ))}
        </button>
      );
    } else {
      const n = i - firstDay - daysInMonth + 1;
      cells.push(
        <div key={`n${i}`} className="min-h-[72px] rounded-lg bg-cream/60 p-1.5">
          <div className="text-[13px] font-bold text-line">{n}</div>
        </div>
      );
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3.5 text-xs">
        {adminView ? (
          <>
            <Legend color="rgba(139,92,246,0.25)" label="Studio Booked" />
            <Legend color="#F4EEE6" label="Blocked (class/ws/admin)" />
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
