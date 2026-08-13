import { AdminShell } from "@/components/AdminShell";
import { SectionHead } from "@/components/ui";
import { LocTabs } from "@/components/LocTabs";
import { StudioCalendar, type CalMarker } from "@/components/StudioCalendar";
import { BlockSlotsButton } from "@/components/BlockSlotsButton";
import { BookStudioOnBehalfButton } from "@/components/BookStudioOnBehalfButton";
import { getStudioBookings } from "@/lib/stats";
import { listStudioBlocks } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function AdminStudio() {
  const { connected, rows } = await getStudioBookings();

  let blocks: Awaited<ReturnType<typeof listStudioBlocks>> = [];
  try {
    blocks = await listStudioBlocks();
  } catch {
    blocks = [];
  }

  // Mark every day of each block's date range that falls in August 2025.
  const markers: Record<number, CalMarker[]> = {};
  for (const b of blocks) {
    const start = new Date(String(b.date));
    const end = new Date(String(b.endDate || b.date));
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      if (dt.getFullYear() === 2025 && dt.getMonth() === 7) {
        (markers[dt.getDate()] ||= []).push({
          tone: "blocked",
          label: `${(b.startTime ?? "").slice(0, 5)} blocked`,
        });
      }
    }
  }

  return (
    <AdminShell>
      <SectionHead
        title="Studio Bookings"
        sub="All studio hire — by location"
        right={
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="badge badge-ok" title="Reading from PostgreSQL">
                ● Live database
              </span>
            ) : (
              <span className="badge badge-warn">● Sample data</span>
            )}
            <BookStudioOnBehalfButton />
            <BlockSlotsButton />
          </div>
        }
      />
      <LocTabs />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">📅 Studio Calendar — August 2025</div>
          <StudioCalendar selectedDay={7} adminView events={markers} />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-3 text-[13px] font-bold text-ink">Upcoming Studio Bookings</div>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border-[1.5px] border-dashed border-line bg-white py-12 text-center shadow-card">
                <div className="text-3xl">🏛️</div>
                <div className="mt-2 font-bold text-ink">No studio bookings yet</div>
                <div className="mt-1 text-[13px] text-muted">
                  Studio hire booked by users will appear here.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {rows.map((b, i) => (
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
                        <span className={`badge ${b.paid === "overdue" ? "badge-danger" : "badge-ok"}`}>
                          {b.paid === "overdue" ? "✗ Overdue" : b.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked slots */}
          <div>
            <div className="mb-3 text-[13px] font-bold text-ink">🚫 Blocked Slots</div>
            {blocks.length === 0 ? (
              <div className="rounded-xl border-[1.5px] border-dashed border-line bg-white py-8 text-center text-[13px] text-muted shadow-card">
                No blocked slots. Use <span className="font-semibold text-grape">+ Block Slots</span>{" "}
                to mark studio time unavailable.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {blocks.map((b) => (
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
      </div>
    </AdminShell>
  );
}
