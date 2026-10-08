// Builds a student's own calendar (.ics) — their classes (every session in
// the dates they booked), workshops, events, studio hire, and studio holidays.
// Server only.

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { classes, events, registrations } from "@/lib/db/schema";
import { listHolidays, PAYMENT_CANCELLED_STATUS, PAYMENT_HOLD_MS, type StudioHoliday } from "@/lib/services";

const JS_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_EVENTS = 800;

/** Studios in India run on India time; everything else on Stockholm time. */
function timeZoneFor(location: string | null | undefined) {
  return /mumbai|india|indore|bhopal|delhi|pune|bangalore|bengaluru/i.test(location ?? "") ? "Asia/Kolkata" : "Europe/Stockholm";
}

/** Wall-clock date + time in a time zone → UTC "YYYYMMDDTHHMMSSZ". */
function toUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // The zone's offset at that moment (handles summer time).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const utc = new Date(guess - (asLocal - guess));
  return utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const compact = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
function* daysBetween(start: string, end: string) {
  for (let d = start; d <= end; d = nextDay(d)) yield d;
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Folds lines at 75 octets, as the iCalendar format requires. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    if (curLen + len > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

type CalEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  // Timed (start/end UTC) or all-day (start/end dates, end exclusive).
  start: string;
  end: string;
  allDay?: boolean;
};

function onHoliday(date: string, location: string | null, holidays: StudioHoliday[]) {
  return holidays.find((h) => date >= h.startDate && date <= h.endDate && (!h.location || h.location === location));
}

function dateRange(period: string | null) {
  const dates = (period ?? "").match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

/** Every calendar entry for one student. */
export async function buildStudentCalendar(email: string, name?: string) {
  if (!db) throw new Error("DATABASE_NOT_CONFIGURED");
  const d = db;
  const normEmail = email.trim().toLowerCase();
  const holdSince = Date.now() - PAYMENT_HOLD_MS;
  const regs = (await d.select().from(registrations).where(eq(registrations.email, normEmail))).filter(
    (r) =>
      r.status !== PAYMENT_CANCELLED_STATUS &&
      // An unpaid online checkout only counts while it could still be paid.
      !(r.paid === "pending" && r.paymentMethod && (r.createdAt?.getTime() ?? 0) < holdSince)
  );
  const classIds = Array.from(new Set(regs.map((r) => r.classId).filter(Boolean) as string[]));
  const eventIds = Array.from(new Set(regs.map((r) => r.eventId).filter(Boolean) as string[]));
  const [classRows, eventRows, holidays] = await Promise.all([
    classIds.length ? d.select().from(classes).where(inArray(classes.id, classIds)) : Promise.resolve([]),
    eventIds.length ? d.select().from(events).where(inArray(events.id, eventIds)) : Promise.resolve([]),
    listHolidays(),
  ]);
  const classById = new Map(classRows.map((c) => [c.id, c]));
  const eventById = new Map(eventRows.map((e) => [e.id, e]));

  const out: CalEvent[] = [];
  const skipped: string[] = [];
  const myLocations = new Set<string>();

  for (const r of regs) {
    myLocations.add(r.location);
    const modeLabel = r.mode === "online" ? "Online" : r.mode === "offline" ? "In-Person" : "";

    if (r.type === "class" && r.classId) {
      const c = classById.get(r.classId);
      if (!c) continue;
      const tz = timeZoneFor(c.location);
      const days = new Set((c.days ?? "").split(",").map((s) => s.trim()).filter(Boolean));
      const booked = dateRange(r.period);
      const start = [booked?.start, c.startDate].filter(Boolean).sort().pop();
      const end = [booked?.end, c.endDate].filter(Boolean).sort()[0] ?? booked?.end ?? c.endDate;
      const dates: string[] = [];
      if (days.size === 0) {
        if (c.startDate) dates.push(c.startDate);
      } else if (start && end) {
        for (const day of daysBetween(start, end)) {
          if (days.has(JS_DAY[new Date(`${day}T00:00:00Z`).getUTCDay()])) dates.push(day);
        }
      }
      for (const day of dates) {
        const h = onHoliday(day, c.location, holidays);
        if (h) {
          skipped.push(`${day} (${h.title})`);
          continue;
        }
        // Online class with a Zoom meeting: the join link goes in the calendar entry.
        const zoom = c.mode === "online" && c.zoomJoinUrl ? c.zoomJoinUrl : null;
        out.push({
          uid: `${r.id}-${compact(day)}@anchor-dance-fitness`,
          summary: `💃 ${c.name}`,
          description: [
            `${c.category} · ${c.level}`,
            modeLabel,
            c.coach ? `Coach: ${c.coach}` : "",
            zoom ? `Join on Zoom: ${zoom}${c.zoomPassword ? `\nPasscode: ${c.zoomPassword}` : ""}` : "",
            `Booking ${r.id}${r.plan ? ` · ${r.plan} plan` : ""}`,
          ]
            .filter(Boolean)
            .join("\n"),
          location: zoom ?? (r.mode === "online" ? `Online (${c.location})` : c.location),
          url: zoom ?? undefined,
          start: toUtc(day, c.startTime.slice(0, 5), tz),
          end: toUtc(day, c.endTime.slice(0, 5), tz),
        });
      }
      continue;
    }

    if ((r.type === "workshop" || r.type === "event") && r.eventId) {
      const e = eventById.get(r.eventId);
      if (!e || !e.eventDate) continue;
      const tz = timeZoneFor(e.location);
      const icon = r.type === "workshop" ? "🎭" : "⭐";
      for (const day of daysBetween(e.eventDate, e.endDate ?? e.eventDate)) {
        const timed = e.startTime && e.endTime;
        out.push({
          uid: `${r.id}-${compact(day)}@anchor-dance-fitness`,
          summary: `${icon} ${e.title}`,
          description: [e.description ?? "", e.coach ? `With ${e.coach}` : "", modeLabel, `Booking ${r.id}`].filter(Boolean).join("\n"),
          location: e.mode === "online" ? `Online (${e.location})` : e.location,
          start: timed ? toUtc(day, e.startTime!.slice(0, 5), tz) : compact(day),
          end: timed ? toUtc(day, e.endTime!.slice(0, 5), tz) : compact(nextDay(day)),
          allDay: !timed,
        });
      }
      continue;
    }

    if (r.type === "studio") {
      // Stored as "<date> · <start>–<end> · <purpose>".
      const [datePart, time, ...purpose] = (r.detail ?? "").split(" · ");
      const day = dateRange(r.period)?.start ?? dateRange(datePart)?.start;
      const t = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(time ?? "");
      if (!day || !t) continue;
      const tz = timeZoneFor(r.location);
      const endDay = t[2] <= t[1] ? nextDay(day) : day;
      out.push({
        uid: `${r.id}@anchor-dance-fitness`,
        summary: "🏛️ Studio hire",
        description: [purpose.join(" · "), `Booking ${r.id}`].filter(Boolean).join("\n"),
        location: r.location,
        start: toUtc(day, t[1], tz),
        end: toUtc(endDay, t[2], tz),
      });
    }
  }

  // Holidays at the student's studios (and those for every studio), from 60 days ago on.
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  for (const h of holidays) {
    if (h.endDate < since) continue;
    if (h.location && !myLocations.has(h.location)) continue;
    out.push({
      uid: `holiday-${h.id}@anchor-dance-fitness`,
      summary: `🏖️ Studio closed — ${h.title}`,
      description: h.location ? `${h.location} studio is closed.` : "All studios are closed.",
      location: h.location ?? undefined,
      start: compact(h.startDate),
      end: compact(nextDay(h.endDate)),
      allDay: true,
    });
  }

  return { events: out.slice(0, MAX_EVENTS), skipped, name };
}

/** The .ics file text. */
export function toIcs(cal: { events: CalEvent[]; name?: string }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Anchor Dance & Fitness//My Classes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`Anchor Dance & Fitness${cal.name ? ` — ${cal.name}` : ""}`)}`,
    "X-WR-TIMEZONE:Europe/Stockholm",
  ];
  for (const e of cal.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      e.allDay ? `DTSTART;VALUE=DATE:${e.start}` : `DTSTART:${e.start}`,
      e.allDay ? `DTEND;VALUE=DATE:${e.end}` : `DTEND:${e.end}`,
      `SUMMARY:${escapeText(e.summary)}`
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.allDay) lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
