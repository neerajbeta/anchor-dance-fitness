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
    // DATABASE_URL must be the SESSION pooler (port 5432 on the pooler host),
    // not the transaction pooler on 6543 — see the warning below.
    //
    // `max` covers the admin pages that load several cards at once; every query
    // past `max` queues, and a queue that never drains is what leaves cards on
    // "Loading…". connect_timeout stops a stalled pooler from hanging a request
    // for ever (postgres.js waits indefinitely by default), so the page shows a
    // real error and a retry instead. Connections are kept open (no
    // idle_timeout): re-opening one costs ~2.5s from here.
    sql = globalForDb._pg ?? postgres(url, { prepare: false, max: 10, connect_timeout: 20 });
    if (process.env.NODE_ENV !== "production") globalForDb._pg = sql;
    // Loud on purpose: on the transaction pooler this app looks broken rather
    // than slow — pages stall on "Loading…" with no error anywhere.
    if (/:6543\//.test(url)) {
      console.warn(
        "[db] DATABASE_URL points at Supabase's TRANSACTION pooler (port 6543). " +
          "Use the SESSION pooler (same host, port 5432) — on 6543 simultaneous queries stall and admin pages hang on \"Loading…\"."
      );
    }
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
