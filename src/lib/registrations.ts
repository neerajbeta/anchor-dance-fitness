import { db, hasDb } from "@/lib/db/client";
import { registrations } from "@/lib/db/schema";
import { REGISTRATIONS, type Registration } from "@/lib/data";

/**
 * Returns registrations from PostgreSQL when a database is configured,
 * otherwise falls back to the bundled mock data so the UI always works.
 */
export async function getRegistrations(): Promise<{
  rows: Registration[];
  source: "database" | "mock";
}> {
  if (hasDb && db) {
    try {
      const rows = await db.select().from(registrations);
      // Connected: return real data as-is — even when empty. Registrations are
      // created only by real admin/user actions, never seeded with dummy rows.
      return { rows: rows as unknown as Registration[], source: "database" };
    } catch (err) {
      // Only fall back to sample data if the DB is genuinely unreachable.
      console.error("[registrations] DB query failed, using sample data:", err);
    }
  }
  return { rows: REGISTRATIONS, source: "mock" };
}
