/**
 * The public origin visitors use (e.g. https://red-stone-….azurestaticapps.net),
 * for redirects and links in emails / payment return URLs.
 *
 * Behind a proxy — Azure Static Web Apps runs the app on an internal
 * localhost:8080 — `req.nextUrl.origin` is the internal address, so it must
 * never be used for anything the browser follows. Order:
 *   1. SITE_URL / NEXT_PUBLIC_SITE_URL (set this in production — it's trusted)
 *   2. the proxy's forwarded host headers
 *   3. the request's own origin (local dev)
 * Edge-safe (used by middleware too).
 */
export function publicOrigin(req: { headers: Headers; nextUrl: { origin: string } }): string {
  const configured = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const h = req.headers;
  const original = h.get("x-ms-original-url"); // Azure Static Web Apps
  if (original) {
    try {
      return new URL(original).origin;
    } catch {
      /* fall through */
    }
  }
  const host = (h.get("x-forwarded-host") || "").split(",")[0].trim();
  if (host) {
    const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
    return `${proto}://${host}`;
  }
  return req.nextUrl.origin;
}
