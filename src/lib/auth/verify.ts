import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { SessionPayload } from "./session";

/**
 * Verifies admin credentials. Order of precedence:
 *  1. If a database is configured, look up an admin user and bcrypt-compare.
 *  2. Otherwise (or if no match), fall back to demo credentials from env
 *     (ADMIN_EMAIL / ADMIN_PASSWORD), defaulting to the documented demo login.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<SessionPayload | null> {
  const normEmail = email.trim().toLowerCase();
  if (!normEmail || !password) return null;

  if (hasDb && db) {
    try {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.email, normEmail), eq(users.role, "admin")));
      const u = rows[0];
      if (u?.passwordHash && (await bcrypt.compare(password, u.passwordHash))) {
        return { email: u.email, name: u.name, role: u.role };
      }
    } catch (err) {
      console.error("[auth] DB lookup failed, trying demo fallback:", err);
    }
  }

  // Demo fallback (no DB, or DB miss) — env-configurable.
  const demoEmail = (process.env.ADMIN_EMAIL || "admin@anchorfitness.com").toLowerCase();
  const demoPass = process.env.ADMIN_PASSWORD || "anchor-admin";
  if (normEmail === demoEmail && password === demoPass) {
    return { email: demoEmail, name: "Admin", role: "admin" };
  }

  return null;
}
