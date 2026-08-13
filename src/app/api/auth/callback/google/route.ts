import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchGoogleProfile } from "@/lib/auth/google";
import { createSessionToken, USER_SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { upsertOAuthUser, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";

const STATE_COOKIE = "af_google_state";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  const error = req.nextUrl.searchParams.get("error");
  if (error) return fail("google_denied");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("google_auth_failed");
  }

  try {
    const accessToken = await exchangeCodeForToken(code, origin);
    const profile = await fetchGoogleProfile(accessToken);
    if (!profile.emailVerified) return fail("google_email_unverified");

    const user = await upsertOAuthUser({ email: profile.email, name: profile.name });
    const token = await createSessionToken({ email: user.email, name: user.name, role: user.role });

    const res = NextResponse.redirect(new URL("/portal", origin));
    res.cookies.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return fail("database_not_configured");
    console.error("[api/auth/callback/google]", err);
    return fail("google_auth_failed");
  }
}
