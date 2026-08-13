import { NextRequest, NextResponse } from "next/server";
import { resolveDiscount, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: live coupon preview during checkout (no write). Body: { code, category?, classId? }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b?.code) return NextResponse.json({ error: "code is required" }, { status: 400 });
    const resolved = await resolveDiscount({ code: b.code, category: b.category, classId: b.classId });
    if (!resolved) return NextResponse.json({ error: "Invalid or inapplicable code" }, { status: 404 });
    return NextResponse.json({ data: resolved });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/discounts/apply]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
