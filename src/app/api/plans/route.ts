import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listPlans, listAllPlans, createPlan, DbNotConfiguredError } from "@/lib/services";
import { parsePlanInput, type PlanInput } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: active plans for the student Choose Plan screen. `?admin=1` returns every
// plan (including inactive) and requires plans.view.
export async function GET(req: NextRequest) {
  const admin = req.nextUrl.searchParams.get("admin") === "1";
  if (admin) {
    const auth = await requirePermission("plans.view");
    if (!auth.ok) return auth.response;
  }
  try {
    return NextResponse.json({ data: admin ? await listAllPlans() : await listPlans() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/plans]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Admin only: add a plan.
export async function POST(req: NextRequest) {
  const auth = await requirePermission("plans.create");
  if (!auth.ok) return auth.response;
  try {
    const parsed = parsePlanInput(await req.json(), false);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const row = await createPlan(parsed.value as Pick<PlanInput, "name" | "interval" | "price"> & Partial<PlanInput>);
    if (!row) return NextResponse.json({ error: "A plan with this name already exists" }, { status: 409 });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/plans]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
