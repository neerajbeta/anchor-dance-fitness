import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { createRegistration, listRegistrations, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const rows = await listRegistrations();
    return NextResponse.json({ data: rows });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    if (!body?.name || !body?.email || !body?.type || !body?.location) {
      return NextResponse.json(
        { error: "name, email, type and location are required" },
        { status: 400 }
      );
    }
    const row = await createRegistration(body);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  console.error("[api/registrations]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
