import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, USER_SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { verifyStudentCredentials, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the login page's email/password form submits here.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b?.email?.trim() || !b?.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const session = await verifyStudentCredentials(b.email, b.password);
    if (!session) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const token = await createSessionToken(session);

    const res = NextResponse.json({ data: { email: session.email, name: session.name } });
    res.cookies.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/auth/login]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
