import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  ConflictError,
  DbNotConfiguredError,
  deletePromotion,
  getPromotionActivity,
  recordAuditLog,
  updatePromotion,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The promotion's enquiries and bookings, for follow-up. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("enquiries.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getPromotionActivity(params.id) });
  } catch (err) {
    return handle(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("enquiries.edit");
  if (!auth.ok) return auth.response;
  try {
    const row = await updatePromotion(params.id, await req.json());
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "promotion.updated",
      module: "promotions",
      targetType: "promotion",
      targetId: row.id,
      newValues: row,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return handle(err);
  }
}

/** Deleting keeps the enquiries and bookings; they just lose the promotion tag. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("enquiries.edit");
  if (!auth.ok) return auth.response;
  try {
    await deletePromotion(params.id);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "promotion.deleted",
      module: "promotions",
      targetType: "promotion",
      targetId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/promotions/:id]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
