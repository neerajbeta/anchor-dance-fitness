import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { requirePermission } from "@/lib/auth/permissions";
import {
  assertNotDuplicateBooking,
  createRegistration,
  listRegistrations,
  DbNotConfiguredError,
  DuplicateBookingError,
} from "@/lib/services";
import { sendBookingConfirmation } from "@/lib/email/notify";
import { isStudioLocation, STUDIO_LOCATION_ERROR } from "@/lib/studioLocations";

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

// Admin "Book on Behalf" flow (customers book themselves through /api/payments/checkout).
export async function POST(req: NextRequest) {
  const auth = await requirePermission("book_on_behalf.create");
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    if (!body?.name || !body?.email || !body?.type || !body?.location) {
      return NextResponse.json(
        { error: "name, email, type and location are required" },
        { status: 400 }
      );
    }
    if (body.type === "studio" && !isStudioLocation(body.location)) {
      return NextResponse.json({ error: STUDIO_LOCATION_ERROR }, { status: 400 });
    }
    await assertNotDuplicateBooking(body);
    const row = await createRegistration(body);
    // The customer hears about a booking an admin made for them too.
    void sendBookingConfirmation(row, req.nextUrl.origin);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DuplicateBookingError) {
    return NextResponse.json(
      { error: err.message.replace("You've already", "This student has already").replace("You can see it in My Portal.", "See Registrations."), existingId: err.existingId },
      { status: 409 }
    );
  }
  if (err instanceof DbNotConfiguredError) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  console.error("[api/registrations]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
