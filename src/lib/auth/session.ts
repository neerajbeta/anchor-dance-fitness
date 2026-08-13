import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// Edge-safe (jose only, no Node APIs) so it can run inside middleware.
export const SESSION_COOKIE = "af_session"; // admin sessions only
export const USER_SESSION_COOKIE = "af_user_session"; // student/user sessions — separate
// cookie so a logged-in student is never mistaken for an admin by middleware.
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-insecure-secret-change-me-in-env-local"
);

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
    .sign(secret);
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
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
