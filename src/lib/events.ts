import { db, hasDb } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { EVENTS, PAST_EVENTS, type EventItem } from "@/lib/data";

function gradientFor(kind: string) {
  return kind === "workshop"
    ? "linear-gradient(135deg,#2E2620,#5C534B)"
    : "linear-gradient(135deg,#3a1f14,#7A241A)";
}

type EventRow = typeof events.$inferSelect;

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
    past: row.isPast,
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
      const rows = await db.select().from(events);
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
