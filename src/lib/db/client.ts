import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Guarded singleton: the app must keep running even when no database is
// configured yet (falls back to mock data). Once DATABASE_URL is set in
// .env.local, real queries light up automatically.
const url = process.env.DATABASE_URL;

export const hasDb = Boolean(url);

// `prepare: false` is required when connecting through Supabase's transaction
// pooler (port 6543). Harmless on a direct connection / Azure Postgres too.
const globalForDb = globalThis as unknown as {
  _pg?: ReturnType<typeof postgres>;
};

// Creating the client parses the connection string — guard it so a malformed
// URL (e.g. a password with unencoded @ ! # characters) degrades to mock data
// instead of crashing the build/app.
let sql: ReturnType<typeof postgres> | undefined;
if (url) {
  try {
    // `max` kept small: Supabase's transaction pooler (PgBouncer) multiplexes a
    // limited backend pool across every client — a large per-instance `max`
    // (postgres.js defaults to 10) can exhaust it under concurrent queries
    // (e.g. the Reports page's parallel KPI queries).
    sql = globalForDb._pg ?? postgres(url, { prepare: false, max: 5 });
    if (process.env.NODE_ENV !== "production") globalForDb._pg = sql;
  } catch (err) {
    console.error(
      "[db] Invalid DATABASE_URL — falling back to mock data. " +
        "Percent-encode special characters in the password (@ → %40, ! → %21, # → %23).",
      err
    );
    sql = undefined;
  }
}

export const db = sql ? drizzle(sql, { schema }) : undefined;
