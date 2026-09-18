"use client";

import { useMemo, useState } from "react";
import { STUDIO_LOCATIONS } from "@/lib/studioLocations";
import { StudioCalendar } from "@/components/StudioCalendar";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Admins use this calendar mainly to set up/review upcoming blocks, so it opens on next month
// by default rather than the current one.
function nextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

type Row = {
  name: string;
  when: string;
  period: string | null;
  location: string;
  price: number;
  discountCode?: string | null;
  paid: string;
  status: string;
  notes?: string | null;
};
type Block = {
  id: string;
  location: string;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  reason: string | null;
};

export function AdminStudioClient({ rows, blocks }: { rows: Row[]; blocks: Block[] }) {
  const [location, setLocation] = useState("");

  const filteredRows = useMemo(
    () => (location ? rows.filter((r) => r.location === location) : rows),
    [rows, location]
  );
  const filteredBlocks = useMemo(
    () => (location ? blocks.filter((b) => b.location === location) : blocks),
    [blocks, location]
  );
  // Only bookings with a real (YYYY-MM-DD) date can be reliably plotted —
  // that's every "Book Studio on Behalf" reservation.
  const calendarBookings = useMemo(
    () =>
      filteredRows
        .filter((r) => r.period && ISO_DATE.test(r.period))
        .map((r) => ({ name: r.name, location: r.location, date: r.period as string, when: r.when })),
    [filteredRows]
  );

  return (
    <>
      <div className="mb-5 max-w-xs">
        <label className="field-label">Filter by Location</label>
        <select className="field" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">🌍 All Locations</option>
          {STUDIO_LOCATIONS.map((l) => (
            <option key={l.label} value={l.label}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card mb-5">
        <div className="card-title">📅 Studio Calendar</div>
        <StudioCalendar
          adminView
          blocks={filteredBlocks}
          bookings={calendarBookings}
          locationFilter={location || undefined}
          initialMonth={nextMonthIso()}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 text-[13px] font-bold text-ink">Upcoming Studio Bookings</div>
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border-[1.5px] border-dashed border-line bg-white py-12 text-center shadow-card">
              <div className="text-3xl">🏛️</div>
              <div className="mt-2 font-bold text-ink">No studio bookings yet</div>
              <div className="mt-1 text-[13px] text-muted">
                Studio hire booked by users will appear here.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredRows.map((b, i) => (
                <div key={i} className="card p-4" style={{ borderLeft: "4px solid #8B5CF6" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-bold text-ink">{b.name}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        {b.when} · {b.location}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="badge badge-grape">SEK {b.price.toLocaleString()}</span>
                      {b.discountCode && <span className="badge badge-ok text-[10px]">🏷️ {b.discountCode}</span>}
                      {b.status === "Payment Cancelled" ? (
                        <span className="badge badge-danger">✗ Payment Cancelled</span>
                      ) : b.paid === "pending" ? (
                        <span className="badge badge-warn">⏳ Awaiting payment</span>
                      ) : (
                        <span className={`badge ${b.paid === "overdue" ? "badge-danger" : "badge-ok"}`}>
                          {b.paid === "overdue" ? "✗ Overdue" : b.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {b.notes && (
                    <div className="mt-2.5 whitespace-pre-line rounded-lg bg-cream/60 px-3 py-2 text-[12px] text-ink">
                      <span className="font-semibold text-muted">📝 Notes: </span>
                      {b.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked slots */}
        <div>
          <div className="mb-3 text-[13px] font-bold text-ink">🚫 Blocked Slots</div>
          {filteredBlocks.length === 0 ? (
            <div className="rounded-xl border-[1.5px] border-dashed border-line bg-white py-8 text-center text-[13px] text-muted shadow-card">
              No blocked slots. Use <span className="font-semibold text-grape">+ Block Slots</span>{" "}
              to mark studio time unavailable.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredBlocks.map((b) => (
                <div key={b.id} className="card p-4" style={{ borderLeft: "4px solid #DC4A3D" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-bold text-ink">
                        {b.endDate && b.endDate !== b.date ? `${b.date} → ${b.endDate}` : b.date} ·{" "}
                        {String(b.startTime).slice(0, 5)}–{String(b.endTime).slice(0, 5)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        {b.location}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </div>
                    </div>
                    <span className="badge badge-danger">Blocked</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
