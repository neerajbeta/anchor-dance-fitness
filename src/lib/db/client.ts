import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The database client, for both hosts this app runs on.
 *
 * **Node** (local dev, Azure): one pooled client for the whole process, as
 * before.
 *
 * **Cloudflare Workers**: a Worker may not reuse a socket opened during another
 * request, so the client is created per request and cached on that request's
 * context. The connection string comes from the Hyperdrive binding, which pools
 * the real connections for us.
 *
 * Everything downstream keeps importing `db` exactly as it did — the export is
 * a proxy that resolves to whichever client the current request should use.
 */

type Database = ReturnType<typeof drizzle<typeof schema>>;

/** Workers sets this; Node never does. */
const onWorkers =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

export const hasDb = onWorkers || Boolean(process.env.DATABASE_URL);

// ───────────────────────── Node ─────────────────────────

const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres>; _db?: Database };

function nodeDb(): Database | undefined {
  if (globalForDb._db) return globalForDb._db;
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
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
    const sql = globalForDb._pg ?? postgres(url, { prepare: false, max: 10, connect_timeout: 20 });
    globalForDb._pg = sql;
    // Loud on purpose: on the transaction pooler this app looks broken rather
    // than slow — pages stall on "Loading…" with no error anywhere.
    if (/:6543\//.test(url)) {
      console.warn(
        "[db] DATABASE_URL points at Supabase's TRANSACTION pooler (port 6543). " +
          "Use the SESSION pooler (same host, port 5432) — on 6543 simultaneous queries stall and admin pages hang on \"Loading…\"."
      );
    }
    const instance = drizzle(sql, { schema });
    globalForDb._db = instance;
    return instance;
  } catch (err) {
    console.error(
      "[db] Invalid DATABASE_URL — falling back to mock data. " +
        "Percent-encode special characters in the password (@ → %40, ! → %21, # → %23).",
      err
    );
    return undefined;
  }
}

// ──────────────────────── Workers ────────────────────────

/** Cached on the request's ExecutionContext, so it lives exactly one request. */
type RequestBag = { __db?: Database };

function workersDb(): Database | undefined {
  // Imported lazily: this module must stay loadable on Node, where the
  // Cloudflare package has nothing to attach to.
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
  const { env, ctx } = getCloudflareContext();
  const vars = env as { HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string };
  // Hyperdrive is the right way round — it pools the real connections and keeps
  // them warm. Without it we still connect straight to the database, which
  // works but pays a fresh handshake, so the binding is worth adding.
  const connectionString = vars.HYPERDRIVE?.connectionString ?? vars.DATABASE_URL;
  if (!connectionString) {
    console.error("[db] Neither a HYPERDRIVE binding nor a DATABASE_URL secret is set on this Worker.");
    return undefined;
  }
  const bag = ctx as unknown as RequestBag;
  if (bag.__db) return bag.__db;
  // A fresh client per request is cheap behind Hyperdrive. `prepare` must stay
  // on: Hyperdrive's pooling doesn't support the extra round-trip postgres.js
  // makes when prepared statements are disabled.
  const sql = postgres(connectionString, { max: 5, fetch_types: false });
  const instance = drizzle(sql, { schema });
  bag.__db = instance;
  return instance;
}

function current(): Database | undefined {
  return onWorkers ? workersDb() : nodeDb();
}

/**
 * The same `db` every caller already imports. On Node it's the one pooled
 * client; on Workers each request gets its own, resolved on first use.
 */
export const db: Database | undefined = hasDb
  ? (new Proxy({} as Database, {
      get(_target, prop, receiver) {
        const real = current();
        if (!real) throw new Error("Database not configured");
        const value = Reflect.get(real as object, prop, receiver);
        return typeof value === "function" ? value.bind(real) : value;
      },
      has: (_t, prop) => Reflect.has((current() ?? {}) as object, prop),
    }) as Database)
  : undefined;
