import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { createSessionToken, USER_SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { registerStudent, DbNotConfiguredError, EmailTakenError } from "@/lib/services";
import { sendWelcomeEmail } from "@/lib/email/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: the "Your Details" signup form submits here. Creates the student
// profile and logs them straight in (no password auth in this app yet).
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b?.name?.trim() || !b?.email?.trim()) {
      return NextResponse.json({ error: "Full name and email are required" }, { status: 400 });
    }
    if (!b?.password || String(b.password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    const user = await registerStudent({
      name: b.name,
      email: b.email,
      password: b.password,
      dob: b.dob,
      gender: b.gender,
      phone: b.phone,
      city: b.city,
      country: b.country,
    });
    void sendWelcomeEmail(user, publicOrigin(req));
    const token = await createSessionToken({ email: user.email, name: user.name, role: user.role });

    const res = NextResponse.json({ data: { email: user.email, name: user.name } }, { status: 201 });
    res.cookies.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    if (err instanceof EmailTakenError)
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/auth/register]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
