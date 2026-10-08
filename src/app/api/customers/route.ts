import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getDropReasonStats, listCustomers, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every customer with their status, plus how often each drop-off reason was used. */
export async function GET() {
  const auth = await requirePermission("customers.view");
  if (!auth.ok) return auth.response;
  try {
    const [customers, reasons] = await Promise.all([listCustomers(), getDropReasonStats()]);
    return NextResponse.json({ data: { customers, reasons } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/customers]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
