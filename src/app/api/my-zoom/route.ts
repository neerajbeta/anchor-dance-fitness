import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import { DbNotConfiguredError, getMyZoomLinks } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zoom links for the signed-in student's booked online classes (empty when signed out). */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ data: [] });
  try {
    return NextResponse.json({ data: await getMyZoomLinks(session.email) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (!(err instanceof DbNotConfiguredError)) console.error("[api/my-zoom]", err);
    return NextResponse.json({ data: [] });
  }
}
