import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, getInvoiceSeller, recordAuditLog, saveInvoiceSeller } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Business details printed on invoices. */
export async function GET() {
  const auth = await requirePermission("settings.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getInvoiceSeller() });
  } catch (err) {
    return handle(err);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const before = await getInvoiceSeller();
    const saved = await saveInvoiceSeller(await req.json());
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "invoice_settings.updated",
      module: "settings",
      targetType: "app_settings",
      oldValues: before,
      newValues: saved,
    });
    return NextResponse.json({ data: saved });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/invoice-settings]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
