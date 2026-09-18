import { NextRequest, NextResponse } from "next/server";
import {
  assertNotDuplicateBooking,
  attachPaymentRef,
  createRegistration,
  DuplicateBookingError,
  getStudioTakenSlots,
  priceBooking,
  PriceError,
  markRegistrationPaid,
  DbNotConfiguredError,
  type RegistrationInput,
} from "@/lib/services";
import { paymentPageUrl } from "@/lib/payments/pages";
import { isStudioLocation, STUDIO_LOCATION_ERROR } from "@/lib/studioLocations";
import { sendBookingConfirmation } from "@/lib/email/notify";
import { getUserSession } from "@/lib/auth/userActions";
import { createCheckoutSession, isStripeConfigured, StripeApiError, StripeNotConfiguredError } from "@/lib/payments/stripe";
import {
  createSwishPaymentRequest,
  isSwishConfigured,
  normalisePayerAlias,
  swishCallbackUrl,
  SwishApiError,
  SwishNotConfiguredError,
} from "@/lib/payments/swish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The public origin Stripe/Swish send the user (and callbacks) back to. */
function publicOrigin(req: NextRequest) {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  return configured || req.nextUrl.origin;
}

/**
 * Starts checkout for a self-service booking.
 *
 * The booking row is written first with `paid: "pending"` so nothing is lost if
 * the payer closes the tab, and the amount is computed server-side (including
 * any discount code) — the gateway is then charged that amount, never a total
 * the browser sent us. The row only flips to paid after Stripe or Swish
 * confirms it (see ../verify, used by each booking type's payment result pages).
 */
export async function POST(req: NextRequest) {
  try {
    const { method, phone, booking } = (await req.json()) as {
      method?: "stripe" | "swish";
      phone?: string;
      booking?: Record<string, unknown>;
    };

    if (method !== "stripe" && method !== "swish") {
      return NextResponse.json({ error: "Choose a payment method." }, { status: 400 });
    }
    if (!booking) {
      return NextResponse.json({ error: "Booking details are required." }, { status: 400 });
    }

    // A signed-in student always books under their own account.
    const session = await getUserSession();
    if (session?.role === "student") {
      booking.email = session.email;
      booking.name = String(booking.name ?? "").trim() || session.name;
    }
    if (!booking.name || !booking.email || !booking.type || !booking.location) {
      return NextResponse.json(
        { error: "name, email, type and location are required" },
        { status: 400 }
      );
    }

    if (method === "stripe" && !isStripeConfigured()) {
      return NextResponse.json({ error: "Card payments aren't available right now." }, { status: 503 });
    }
    const origin = publicOrigin(req);
    const callbackUrl = swishCallbackUrl(origin);

    // Checked before the booking row is written, so a misconfigured host can't
    // leave unpaid rows behind.
    if (method === "swish" && !(await isSwishConfigured(origin))) {
      console.error(
        `[api/payments/checkout] Swish unavailable — certificate missing, or callback "${callbackUrl}" isn't public HTTPS (set SWISH_CALLBACK_URL / NEXT_PUBLIC_SITE_URL).`
      );
      return NextResponse.json({ error: "Swish isn't available right now." }, { status: 503 });
    }

    // Checked before anything is saved, so a typo doesn't leave an unpaid booking behind.
    if (method === "swish" && !normalisePayerAlias(String(phone ?? ""))) {
      return NextResponse.json(
        { error: "Enter a valid Swedish mobile number, e.g. 070 123 45 67." },
        { status: 400 }
      );
    }

    // Studio Hire: re-check the slot on the server — it may have been taken
    // since the customer opened the page.
    if (booking.type === "studio") {
      if (!isStudioLocation(booking.location)) {
        return NextResponse.json({ error: STUDIO_LOCATION_ERROR }, { status: 400 });
      }
      const slotDate = String(booking.slotDate ?? "");
      const time = /(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/.exec(String(booking.detail ?? ""));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !time) {
        return NextResponse.json({ error: "Choose a studio date and time." }, { status: 400 });
      }
      const taken = await getStudioTakenSlots(String(booking.location), slotDate);
      const clash = taken.some((t) => time[1] < t.end && t.start < time[2]);
      if (clash) {
        return NextResponse.json(
          { error: "Sorry — that studio time was just booked. Please pick another slot." },
          { status: 409 }
        );
      }
    }

    // One live booking per person per class / workshop / event.
    await assertNotDuplicateBooking({
      email: String(booking.email),
      type: String(booking.type),
      classId: booking.classId as string | undefined,
      eventId: booking.eventId as string | undefined,
      detail: booking.detail as string | undefined,
    });

    // The price always comes from the database — a changed baseAmount in the
    // request can't lower what the customer is charged.
    const baseAmount = await priceBooking({
      type: String(booking.type),
      detail: booking.detail as string | undefined,
      plan: booking.plan as string | undefined,
      classId: booking.classId as string | undefined,
      eventId: booking.eventId as string | undefined,
    });

    // Unpaid until the gateway says otherwise.
    const row = await createRegistration({
      ...(booking as unknown as RegistrationInput),
      baseAmount,
      paid: "pending",
    });

    // Fully discounted / free booking — nothing to charge.
    if (row.amount <= 0) {
      const paid = await markRegistrationPaid(row.id, method, "free");
      if (paid) void sendBookingConfirmation(paid, origin);
      return NextResponse.json({ data: { registration: paid ?? row, settled: true } }, { status: 201 });
    }

    const description = `${row.detail || "Anchor Dance & Fitness"}${row.plan ? ` · ${row.plan}` : ""}`;

    if (method === "stripe") {
      const stripeSession = await createCheckoutSession({
        amount: row.amount,
        description,
        email: row.email,
        registrationId: row.id,
        // This booking type's own result pages — the same ones the Swish flow ends on.
        successUrl: `${origin}${paymentPageUrl(row.type, "success", row.id)}`,
        cancelUrl: `${origin}${paymentPageUrl(row.type, "cancelled", row.id)}`,
      });
      await attachPaymentRef(row.id, "stripe", stripeSession.id);
      return NextResponse.json(
        { data: { registration: row, redirectUrl: stripeSession.url } },
        { status: 201 }
      );
    }

    const swish = await createSwishPaymentRequest({
      amount: row.amount,
      phone: String(phone ?? ""),
      payeeReference: row.id.replace(/[^A-Za-z0-9]/g, ""),
      message: `Anchor ${row.id}`,
      callbackUrl,
    });
    await attachPaymentRef(row.id, "swish", swish.instructionId);

    return NextResponse.json(
      {
        data: {
          registration: row,
          swish: {
            amount: swish.amount,
            payeeAlias: swish.payeeAlias,
            appLink: swish.appLink,
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof DuplicateBookingError) {
      return NextResponse.json({ error: err.message, existingId: err.existingId }, { status: 409 });
    }
    if (err instanceof PriceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    if (err instanceof SwishNotConfiguredError || err instanceof StripeNotConfiguredError) {
      console.error("[api/payments/checkout]", err.message);
      return NextResponse.json({ error: "This payment method isn't available right now." }, { status: 503 });
    }
    if (err instanceof SwishApiError || err instanceof StripeApiError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/payments/checkout]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
