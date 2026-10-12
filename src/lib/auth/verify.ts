import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import type { SessionPayload } from "./session";

/**
 * Verifies admin credentials against the admin accounts in the database.
 *
 * There is also a fallback login for working on the app before any admin
 * exists, but it is deliberately hard to leave switched on: both ADMIN_EMAIL
 * and ADMIN_PASSWORD must be set explicitly, there are no built-in defaults,
 * and it is ignored entirely in production. It used to default to a published
 * email and password, which meant any deployed site could be signed into by
 * anyone who had read the docs.
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
      if (u?.status === "inactive") return null; // deactivated admin account
      if (u?.passwordHash && (await bcrypt.compare(password, u.passwordHash))) {
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
        return { email: u.email, name: u.name, role: u.role };
      }
    } catch (err) {
      // A database that is down must not quietly open a different way in.
      console.error("[auth] admin lookup failed:", err);
      return null;
    }
  }

  // Development-only fallback, off unless both variables are set by hand.
  if (process.env.NODE_ENV !== "production") {
    const devEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const devPass = process.env.ADMIN_PASSWORD;
    if (devEmail && devPass && normEmail === devEmail && password === devPass) {
      return { email: devEmail, name: "Admin", role: "admin" };
    }
  }

  return null;
}
