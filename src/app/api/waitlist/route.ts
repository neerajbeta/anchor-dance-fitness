import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import {
  DbNotConfiguredError,
  getMyWaitlist,
  getUserPhone,
  joinWaitlist,
  leaveWaitlist,
  WaitlistError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET → the signed-in student's live waitlist entries (empty when signed out). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ data: [] });
  try {
    return NextResponse.json({ data: await getMyWaitlist(session.email) });
  } catch (err) {
    if (!(err instanceof DbNotConfiguredError)) console.error("[api/waitlist]", err);
    return NextResponse.json({ data: [] });
  }
}

/**
 * Join the waitlist of a full class / workshop / event.
 * Body: { type, classId? , eventId?, name?, email?, phone? } — a signed-in
 * student always joins under their own account.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const session = await getUserSession();
    const email = String(session?.role === "student" ? session.email : b?.email ?? "").trim().toLowerCase();
    const name = String(b?.name ?? "").trim() || (session?.role === "student" ? session.name : "");
    if (!["class", "workshop", "event"].includes(b?.type)) {
      return NextResponse.json({ error: "Choose a class, workshop or event." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || !name) {
      return NextResponse.json({ error: "Please sign in, or give your name and email." }, { status: 400 });
    }
    const phone = String(b?.phone ?? "").trim() || (await getUserPhone(email));
    const { entry, position, already } = await joinWaitlist({
      type: b.type,
      classId: b.classId,
      eventId: b.eventId,
      name,
      email,
      phone,
    });
    return NextResponse.json({ data: { id: entry.id, status: entry.status, position, already } }, { status: already ? 200 : 201 });
  } catch (err) {
    return handle(err);
  }
}

/** Leave a waitlist — ?id=<entry id>. Signed-in students only, own entries only. */
export async function DELETE(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const row = await leaveWaitlist(id, session.email);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof WaitlistError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/waitlist]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
