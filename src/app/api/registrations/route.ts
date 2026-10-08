import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { requireAdmin } from "@/lib/auth/api";
import { requirePermission } from "@/lib/auth/permissions";
import {
  assertCustomerCanBook,
  assertSeatAvailable,
  SeatsFullError,
  attachPaymentRef,
  autoResumeCustomer,
  ensureInvoice,
  CustomerBlacklistedError,
  assertNotDuplicateBooking,
  createRegistration,
  listRegistrations,
  DbNotConfiguredError,
  DuplicateBookingError,
} from "@/lib/services";
import { sendBookingConfirmation } from "@/lib/email/notify";
import { isStudioLocation, STUDIO_LOCATION_ERROR } from "@/lib/studioLocations";
import {
  createSwishPaymentRequest,
  swishCallbackUrl,
  SwishApiError,
  SwishNotConfiguredError,
} from "@/lib/payments/swish";

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
    await assertCustomerCanBook(body.email);
    await assertNotDuplicateBooking(body);
    // Full? Admins can still book over capacity, but only when they say so.
    if (body.overbook !== true) await assertSeatAvailable(body);
    const row = await createRegistration(body);
    // Booking a paused / dropped-off customer again brings them back on their old record.
    await autoResumeCustomer(row.email, row.id);
    // Paid at the studio → invoice straight away.
    if (row.paid === "paid") await ensureInvoice(row.id).catch((err) => console.error(`[invoice] ${row.id}:`, err));

    // "Send a Swish request": the booking is saved as pending and the customer
    // approves the charge in their own Swish app. The booking stays even if
    // Swish refuses the request, so the admin can retry or take payment another
    // way — the error is reported rather than losing their work.
    const swishPhone = String(body.swishPhone ?? "").trim();
    let swish: { payeeAlias: string; amount: number } | null = null;
    let swishError: string | null = null;
    if (swishPhone) {
      const origin = publicOrigin(req);
      try {
        if (row.amount <= 0) throw new SwishApiError("There's nothing to charge — the total is SEK 0.");
        const req_ = await createSwishPaymentRequest({
          amount: row.amount,
          phone: swishPhone,
          payeeReference: row.id.replace(/[^A-Za-z0-9]/g, ""),
          message: `Anchor ${row.id}`,
          callbackUrl: swishCallbackUrl(origin),
        });
        await attachPaymentRef(row.id, "swish", req_.instructionId);
        swish = { payeeAlias: req_.payeeAlias, amount: req_.amount };
      } catch (err) {
        console.error(`[swish] booking ${row.id}:`, err);
        swishError =
          err instanceof SwishNotConfiguredError
            ? "Swish isn't set up on this site yet — upload the certificate in Portal Settings."
            : err instanceof SwishApiError
            ? err.message
            : "Swish couldn't take the request. The booking was saved as unpaid.";
      }
    }

    // The customer hears about a booking an admin made for them too.
    void sendBookingConfirmation(row, publicOrigin(req));
    return NextResponse.json({ data: row, swish, swishError }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof SeatsFullError) {
    return NextResponse.json(
      { error: "This class is full — every seat is booked. Book anyway (over capacity), or add them to the waitlist from Batch Capacity.", full: true },
      { status: 409 }
    );
  }
  if (err instanceof CustomerBlacklistedError) {
    return NextResponse.json(
      { error: "This customer is blacklisted. Remove them from the blacklist in Customers before booking." },
      { status: 403 }
    );
  }
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
