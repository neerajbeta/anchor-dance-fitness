import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, recordAuditLog } from "@/lib/services";
import { sendInvoiceEmail } from "@/lib/email/notify";
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: email the booking's invoice (PDF attached) to the customer. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAnyPermission(["payments.view", "customers.edit"]);
  if (!auth.ok) return auth.response;
  try {
    const outcome = await sendInvoiceEmail(params.id, publicOrigin(req));
    if (outcome === "not-invoiceable")
      return NextResponse.json({ error: "This booking has no invoice — it isn't paid, or nothing was charged." }, { status: 409 });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "invoice.emailed",
      module: "payments",
      targetType: "registration",
      targetId: params.id,
      newValues: { outcome },
    });
    const messages: Record<string, string> = {
      sent: "Invoice emailed to the customer.",
      logged: "Email isn't set up on this server (POSTMARK_SERVER_TOKEN) — nothing was sent.",
      disabled: "The Invoice email template is switched off in Email Templates.",
      failed: "Sending failed — see Email Templates → recent sends for the reason.",
    };
    return NextResponse.json({ data: { outcome, message: messages[outcome] ?? outcome } }, { status: outcome === "failed" ? 502 : 200 });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/invoices/:id/email]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
