import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  ConflictError,
  createPromotion,
  DbNotConfiguredError,
  listPromotionsWithStats,
  recordAuditLog,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every promotion with its clicks, enquiries, bookings and revenue. */
export async function GET() {
  const auth = await requirePermission("enquiries.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listPromotionsWithStats() });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("enquiries.edit");
  if (!auth.ok) return auth.response;
  try {
    const row = await createPromotion(await req.json(), auth.actor.name);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "promotion.created",
      module: "promotions",
      targetType: "promotion",
      targetId: row.id,
      newValues: row,
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/promotions]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
