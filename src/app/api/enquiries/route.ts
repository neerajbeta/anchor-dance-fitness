import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { createEnquiry, listEnquiries, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin only: view submitted "Book a Demo" leads.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listEnquiries() });
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
