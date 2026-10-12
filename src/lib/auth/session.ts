import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Edge-safe (jose only, no Node APIs) so it can run inside middleware.
export const SESSION_COOKIE = "af_session"; // admin sessions only
export const USER_SESSION_COOKIE = "af_user_session"; // student/user sessions — separate
// cookie so a logged-in student is never mistaken for an admin by middleware.
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

/**
 * The key session cookies are signed with.
 *
 * There is a fixed fallback so a fresh checkout runs without any setup, but it
 * is written in this file — anyone who can read the source could mint an admin
 * cookie with it. So in production AUTH_SECRET must be set, and a deployment
 * that forgets it fails to sign or verify anything rather than quietly trusting
 * a secret that is not secret. Read on each call, not at module load, so the
 * failure is a handled error on one request instead of a dead Worker.
 */
function signingKey(): Uint8Array {
  const configured = (process.env.AUTH_SECRET ?? "").trim();
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set — refusing to sign sessions with the built-in development key.");
  }
  return new TextEncoder().encode("dev-insecure-secret-change-me-in-env-local");
}

export type SessionPayload = {
  email: string;
  name: string;
  role: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    return {
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? ""),
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
