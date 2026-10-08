import { db, hasDb } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { EVENTS, PAST_EVENTS, type EventItem } from "@/lib/data";
import { withLiveEventSeats } from "@/lib/services";
import { sweepWaitlistsSoon } from "@/lib/waitlist";

function gradientFor(kind: string) {
  return kind === "workshop"
    ? "linear-gradient(135deg,#2E2620,#5C534B)"
    : "linear-gradient(135deg,#3a1f14,#7A241A)";
}

type EventRow = typeof events.$inferSelect;

// "Past" is derived from the real event date, not the DB's `isPast` flag —
// that flag is only ever set to false at creation and never updated, so it
// can't be trusted to reflect whether the event has actually happened.
function isPastEvent(row: EventRow): boolean {
  const todayIso = new Date().toISOString().slice(0, 10);
  const endOrStart = row.endDate ?? row.eventDate;
  if (endOrStart) return endOrStart < todayIso;
  return row.isPast;
}

function toItem(row: EventRow): EventItem {
  return {
    id: row.id,
    kind: (row.kind as "workshop" | "event") ?? "workshop",
    title: row.title,
    emoji: row.emoji ?? "🎭",
    gradient: gradientFor(row.kind),
    date: row.date,
    desc: row.description ?? "",
    mode: row.mode ?? "online",
    location: row.location,
    coach: row.coach ?? "",
    price: row.price,
    seatsLeft: row.seatsLeft,
    seatsTotal: row.seatsTotal,
    media: "",
    past: isPastEvent(row),
    attended: row.seatsTotal,
    eventDate: row.eventDate ?? undefined,
    endDate: row.endDate ?? undefined,
    startTime: row.startTime ? row.startTime.slice(0, 5) : undefined,
    endTime: row.endTime ? row.endTime.slice(0, 5) : undefined,
  };
}

export type EventsResult = {
  upcoming: EventItem[];
  past: EventItem[];
  source: "database" | "mock";
};

/**
 * Reads events from PostgreSQL. When the DB is connected, returns real rows
 * (even if empty) — no dummy data. Falls back to sample data only when the DB
 * is unreachable/unconfigured (so the prototype still demos without a DB).
 */
export async function getEvents(): Promise<EventsResult> {
  if (hasDb && db) {
    try {
      // Real seats left (live bookings + waitlist holds), not the stored figure.
      const rows = await withLiveEventSeats(await db.select().from(events));
      sweepWaitlistsSoon();
      const items = rows.map(toItem);
      return {
        upcoming: items.filter((e) => !e.past),
        past: items.filter((e) => e.past),
        source: "database",
      };
    } catch (err) {
      console.error("[events] DB query failed, using sample data:", err);
    }
  }
  return { upcoming: EVENTS, past: PAST_EVENTS, source: "mock" };
}
