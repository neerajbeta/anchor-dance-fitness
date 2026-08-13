import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/auth/google";

export const runtime = "nodejs";

const STATE_COOKIE = "af_google_state";

export async function GET(req: NextRequest) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", req.nextUrl.origin)
    );
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildGoogleAuthUrl(req.nextUrl.origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min — just long enough to complete the redirect round-trip
  });
  return res;
}
