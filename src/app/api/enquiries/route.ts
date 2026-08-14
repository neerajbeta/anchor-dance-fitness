import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { createEnquiry, listEnquiries, listUnconvertedSignups, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin only: view "Book a Demo" leads + registered students who haven't
// booked a service yet — both are people who showed interest but didn't
// (yet) take a class/workshop/event/studio booking.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const [demoLeads, signups] = await Promise.all([listEnquiries(), listUnconvertedSignups()]);
    const data = [
      ...demoLeads.map((e) => ({
        id: e.id,
        source: "demo" as const,
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

// Public: the "Book a Demo" form submits here — no auth required.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b?.fullName?.trim() || !b?.email?.trim() || !b?.phone?.trim()) {
      return NextResponse.json({ error: "fullName, email and phone are required" }, { status: 400 });
    }
    if (!b?.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }
    const row = await createEnquiry({
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
