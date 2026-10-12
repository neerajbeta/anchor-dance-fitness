// Reads a file out of `public/` from server code, on either host.
//
// A Node server reads it off disk. A Worker has no filesystem — `fs.readFile`
// there throws "[unenv] fs.readFile is not implemented yet!" — so it asks its
// own static assets for the same path instead.

/** Workers sets this; Node never does. */
const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/**
 * @param publicPath path under `public/`, e.g. "email/logo.png" — no leading slash.
 * @returns the bytes, or null if they can't be read. Callers treat a missing
 *          file as cosmetic; nothing here should fail a booking or an invoice.
 */
export async function readPublicAsset(publicPath: string): Promise<Buffer | null> {
  const rel = publicPath.replace(/^\/+/, "");
  try {
    if (onWorkers) {
      const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
      const assets = (getCloudflareContext().env as { ASSETS?: { fetch: (req: Request) => Promise<Response> } }).ASSETS;
      if (!assets) return null;
      // The host is ignored by the assets binding — only the path is looked up.
      const res = await assets.fetch(new Request(`https://assets.local/${rel}`));
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return await readFile(path.join(process.cwd(), "public", ...rel.split("/")));
  } catch (err) {
    console.error(`[public-asset] couldn't read ${rel}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
