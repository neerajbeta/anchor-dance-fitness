import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current student session (from the af_user_session cookie). Used by client
// booking pages to show the signed-in user and prefill their details.
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ data: null }, { status: 401 });
  return NextResponse.json({ data: { name: session.name, email: session.email } });
}
