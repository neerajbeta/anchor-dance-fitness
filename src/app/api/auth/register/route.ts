import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, USER_SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { registerStudent, DbNotConfiguredError } from "@/lib/services";

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
    const user = await registerStudent({
      name: b.name,
      email: b.email,
      dob: b.dob,
      gender: b.gender,
      phone: b.phone,
      city: b.city,
      country: b.country,
    });
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
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/auth/register]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
