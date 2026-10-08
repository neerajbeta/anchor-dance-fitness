import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, listInvoiceNumbers } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Invoice numbers issued so far, by booking id (for admin lists). */
export async function GET() {
  const auth = await requireAnyPermission(["payments.view", "customers.view"]);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await listInvoiceNumbers() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/invoices]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
