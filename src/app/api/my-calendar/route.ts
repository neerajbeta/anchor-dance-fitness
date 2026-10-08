import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import { buildStudentCalendar, toIcs } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in student's own calendar as an .ics download (classes, workshops, events, studio, holidays). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const cal = await buildStudentCalendar(session.email, session.name);
    return new NextResponse(toIcs(cal), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="anchor-dance-fitness-calendar.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/my-calendar]", err);
    return NextResponse.json({ error: "Couldn't build your calendar." }, { status: 500 });
  }
}
