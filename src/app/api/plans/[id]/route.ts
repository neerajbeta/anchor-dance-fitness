import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { updatePlan, deletePlan, DbNotConfiguredError } from "@/lib/services";
import { parsePlanInput } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("plans.edit");
  if (!auth.ok) return auth.response;
  try {
    const parsed = parsePlanInput(await req.json(), true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const row = await updatePlan(params.id, parsed.value);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/plans/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("plans.delete");
  if (!auth.ok) return auth.response;
  try {
    await deletePlan(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    // Foreign-key violation: something still references this plan.
    const code = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "23503")
      return NextResponse.json({ error: "This plan is in use — deactivate it instead." }, { status: 409 });
    console.error("[api/plans/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
