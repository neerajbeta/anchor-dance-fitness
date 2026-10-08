import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  createEnquiry,
  listEnquiries,
  listUnconvertedSignups,
  listPromotionsWithStats,
  listEvents,
  validPromotionId,
  PROMO_COOKIE,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin only: view "Book a Demo" leads + registered students who haven't
// booked a service yet — both are people who showed interest but didn't
// (yet) take a class/workshop/event/studio booking.
export async function GET() {
  const auth = await requirePermission("enquiries.view");
  if (!auth.ok) return auth.response;
  try {
    const [demoLeads, signups] = await Promise.all([listEnquiries(), listUnconvertedSignups()]);
    const [promos, evs] = await Promise.all([listPromotionsWithStats(), listEvents()]);
    const promoName = new Map(promos.map((p) => [p.id, p.name]));
    const eventTitle = new Map(evs.map((e) => [e.id, e.title]));
    const data = [
      ...demoLeads.map((e) => ({
        id: e.id,
        source: e.kind === "workshop" ? ("workshop" as const) : ("demo" as const),
        eventTitle: e.eventId ? eventTitle.get(e.eventId) ?? null : null,
        promotionId: e.promotionId,
        promotion: e.promotionId ? promoName.get(e.promotionId) ?? null : null,
        fullName: e.fullName,
        age: e.age,
        email: e.email,
        phoneCountryCode: e.phoneCountryCode,
        phone: e.phone,
        areaOfInterest: e.areaOfInterest,
        typeOfClass: e.typeOfClass,
        preferredLocation: e.preferredLocation,
        additionalInfo: e.additionalInfo,
        status: e.status,
        createdAt: e.createdAt,
      })),
      ...signups.map((u) => ({
        id: u.id,
        source: "signup" as const,
        eventTitle: null,
        promotionId: null,
        promotion: null,
        fullName: u.name,
        age: null,
        email: u.email,
        phoneCountryCode: null,
        phone: u.phone,
        areaOfInterest: null,
        typeOfClass: null,
        preferredLocation: u.city ? `${u.city}${u.country ? `, ${u.country}` : ""}` : null,
        additionalInfo: null,
        status: null,
        createdAt: u.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/enquiries]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Public: the "Book a Demo" form and the workshop "Ask a question" form submit
// here — no auth required. A promotion link opened earlier is credited.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b?.fullName?.trim() || !b?.email?.trim() || !b?.phone?.trim()) {
      return NextResponse.json({ error: "fullName, email and phone are required" }, { status: 400 });
    }
    if (!b?.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }
    const kind = b.kind === "workshop" ? "workshop" : "demo";
    const promotionId = await validPromotionId(req.cookies.get(PROMO_COOKIE)?.value);
    const row = await createEnquiry({
      kind,
      eventId: kind === "workshop" && typeof b.eventId === "string" ? b.eventId : null,
      promotionId,
      fullName: b.fullName,
      age: b.age ? Number(b.age) : undefined,
      email: b.email,
      phoneCountryCode: b.phoneCountryCode,
      phone: b.phone,
      areaOfInterest: b.areaOfInterest,
      typeOfClass: b.typeOfClass,
      preferredLocation: b.preferredLocation,
      additionalInfo: b.additionalInfo,
      consent: Boolean(b.consent),
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/enquiries]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
