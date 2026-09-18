// How a class runs: a recurring series on set weekdays between two dates, or a
// single one-off session. Shared by the admin Classes screen and Book a Class.
//
// Admin → Classes saves a series with `days` ("Mon, Wed, Fri") + start/end
// date, and a one-off with no days and start = end = its single date.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
// JS getDay(): 0=Sun..6=Sat — map to our Mon-first labels above.
const JS_DAY_TO_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Schedule = { days: string | null; startDate: string | null; endDate: string | null };

export function parseDays(days: string | null): Set<string> {
  if (!days) return new Set();
  return new Set(
    days
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
  );
}

/** A series repeats on weekdays; anything without days is a one-off session. */
export function isSeries(c: Schedule) {
  return parseDays(c.days).size > 0;
}

// How many sessions a recurring class actually runs, given its date range and selected
// weekdays — computed instead of asked for, since a manually-typed count drifts from reality
// the moment the date range changes.
export function countSessions(startDate: string, endDate: string, days: Set<string>): number {
  if (!startDate || !endDate || days.size === 0) return 0;
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (end < start) return 0;
  let n = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.has(JS_DAY_TO_LABEL[d.getDay()])) n++;
  }
  return n;
}

/** The last day the class runs — a one-off's single date when it has no end date. */
export function lastClassDate(c: Schedule) {
  return c.endDate ?? (isSeries(c) ? null : c.startDate);
}

const dateLabel = (iso: string, withWeekday = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** "15 Sept 2026 → 31 Dec 2026" for a series, "Fri, 18 Sept 2026" for a one-off. */
export function scheduleDates(c: Schedule): string | null {
  if (!isSeries(c)) return c.startDate ? dateLabel(c.startDate, true) : null;
  if (c.startDate && c.endDate) return `${dateLabel(c.startDate)} → ${dateLabel(c.endDate)}`;
  if (c.startDate) return `From ${dateLabel(c.startDate)}`;
  if (c.endDate) return `Until ${dateLabel(c.endDate)}`;
  return null;
}
