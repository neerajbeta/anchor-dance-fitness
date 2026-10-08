import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  CustomerStatusError,
  DbNotConfiguredError,
  getCustomerDetail,
  recordAuditLog,
  updateCustomerStatus,
} from "@/lib/services";
import type { CustomerAction } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: CustomerAction[] = ["paused", "dropped", "resumed", "blacklisted", "unblacklisted"];

/** A customer's profile, status history and every booking they've made. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("customers.view");
  if (!auth.ok) return auth.response;
  try {
    const row = await getCustomerDetail(params.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    return handle(err);
  }
}

/** Pause / drop / resume / blacklist — body: { action, reasonCode?, note? }. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("customers.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!ACTIONS.includes(b?.action)) {
      return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
    }
    const before = await getCustomerDetail(params.id);
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await updateCustomerStatus({
      id: params.id,
      action: b.action,
      reasonCode: b.reasonCode,
      note: b.note,
      actorName: auth.actor.name,
    });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: `customer.${b.action}`,
      module: "customers",
      targetType: "user",
      targetId: params.id,
      oldValues: { customerStatus: before.customerStatus, blacklisted: before.blacklisted, reason: before.statusReason },
      newValues: { customerStatus: row?.customerStatus, blacklisted: row?.blacklisted, reason: row?.statusReason, note: b.note ?? null },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof CustomerStatusError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/customers/:id]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
