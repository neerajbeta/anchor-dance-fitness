import { NextRequest, NextResponse } from "next/server";
import { createRegistration, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public self-service booking endpoint — used by the user-facing booking flow
 * (Book Class → Plans/Pay, Book Studio). Unlike /api/registrations (admin-only,
 * used by Book on Behalf), this has no admin gate: the app has no real student
 * login yet, so a visitor books for themselves directly here. Creates a
 * registration row (+ matching student user) exactly like the admin flow does,
 * so bookings show up in All Registrations, Dashboard, Payments and Reports.
 */
export async function POST(req: NextRequest) {
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
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    console.error("[api/bookings]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
