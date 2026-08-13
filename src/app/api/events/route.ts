import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { createEvent, listEvents, DbNotConfiguredError, ConflictError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listEvents() });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.title || !b?.date || !b?.location || !b?.mode || !b?.kind) {
      return NextResponse.json(
        { error: "kind, title, date, location and mode are required" },
        { status: 400 }
      );
    }
    const ev = await createEvent({
      kind: b.kind,
      title: b.title,
      description: b.description,
      emoji: b.emoji,
      date: b.date,
      eventDate: b.eventDate,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime: b.endTime,
      mode: b.mode,
      location: b.location,
      coach: b.coach,
      price: Number(b.price) || 0,
      seatsTotal: Number(b.seatsTotal) || 0,
      couponCode: b.couponCode,
    });
    return NextResponse.json({ data: ev }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof ConflictError)
    return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/events]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
