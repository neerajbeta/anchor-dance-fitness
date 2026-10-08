/**
 * Short-lived cache of the resolved admin actor (their role + permission set).
 *
 * Every admin API call runs the RBAC guard, and one admin page can fire a dozen
 * of those at once — the Settings page alone loads about eight cards. Each
 * lookup costs two round trips to the database and can need a fresh pooled
 * connection, which is what left cards sitting on "Loading…".
 *
 * Its own module so the services layer can clear it without importing the guard
 * (which imports the services layer).
 */

export type CachedActor<T> = { at: number; actor: T | null };

export const ACTOR_TTL_MS = 8_000;

const cache = new Map<string, CachedActor<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function getCachedActor<T>(key: string): { hit: true; actor: T | null } | { hit: false } {
  const row = cache.get(key) as CachedActor<T> | undefined;
  if (row && Date.now() - row.at < ACTOR_TTL_MS) return { hit: true, actor: row.actor };
  return { hit: false };
}

export function getInFlightActor<T>(key: string): Promise<T | null> | undefined {
  return inFlight.get(key) as Promise<T | null> | undefined;
}

/** Runs `lookup` once per key even when several requests arrive together. */
export function shareActorLookup<T>(key: string, lookup: () => Promise<T | null>): Promise<T | null> {
  const running = lookup()
    .then((actor) => {
      cache.set(key, { at: Date.now(), actor });
      return actor;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, running);
  return running;
}

/** Call after anything that can change what an admin may do. */
export function invalidateAdminActorCache() {
  cache.clear();
  inFlight.clear();
}
