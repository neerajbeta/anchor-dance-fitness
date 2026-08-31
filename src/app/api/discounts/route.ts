import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listDiscounts, createDiscount, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public GET: booking forms need discount codes to apply.
export async function GET() {
  try {
    return NextResponse.json({ data: await listDiscounts() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/discounts]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("discounts.create");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name?.trim() || !b?.code?.trim()) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }
    const type = b.type === "flat" ? "flat" : "percent";
    let pct = 0;
    let flatAmount = 0;
    if (type === "percent") {
      pct = Number(b.percent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: "percent must be 0–100" }, { status: 400 });
      }
    } else {
      flatAmount = Number(b.flatAmount);
      if (!Number.isFinite(flatAmount) || flatAmount < 0) {
        return NextResponse.json({ error: "flatAmount must be a positive number" }, { status: 400 });
      }
    }
    const scope = ["all", "category", "class", "event", "workshop", "studio"].includes(b.scope)
      ? b.scope
      : "all";
    if (!["all", "studio"].includes(scope) && !b.target) {
      return NextResponse.json({ error: "target required for this scope" }, { status: 400 });
    }
    if (b.validFrom && b.validUntil && b.validUntil < b.validFrom) {
      return NextResponse.json({ error: "Valid Until must be on or after Valid From" }, { status: 400 });
    }
    const row = await createDiscount({
      name: b.name,
      code: b.code,
      type,
      percent: pct,
      flatAmount,
      scope,
      target: b.target,
      validFrom: b.validFrom,
      validUntil: b.validUntil,
    });
    if (!row) return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/discounts]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
