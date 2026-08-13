import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
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
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!b?.name?.trim() || !b?.code?.trim() || b?.percent == null) {
      return NextResponse.json({ error: "name, code and percent are required" }, { status: 400 });
    }
    const pct = Number(b.percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: "percent must be 0–100" }, { status: 400 });
    }
    const scope = ["all", "category", "class"].includes(b.scope) ? b.scope : "all";
    if (scope !== "all" && !b.target) {
      return NextResponse.json({ error: "target required for category/class scope" }, { status: 400 });
    }
    const row = await createDiscount({ name: b.name, code: b.code, percent: pct, scope, target: b.target });
    if (!row) return NextResponse.json({ error: "Code already exists" }, { status: 409 });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/discounts]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
