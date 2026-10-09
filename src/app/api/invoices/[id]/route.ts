import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import { getCurrentAdminActor, hasPermission } from "@/lib/auth/permissions";
import { DbNotConfiguredError, ensureInvoice, getRegistrationById } from "@/lib/services";
import { invoiceFileName, renderInvoicePdf } from "@/lib/invoicePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The invoice PDF for a booking (id = booking id, e.g. AF-0124). Open to the
 * student who made the booking and to admins who can see payments or
 * customers. Add ?download=1 to save it instead of opening it.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  try {
    const reg = await getRegistrationById(params.id);
    if (!reg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [session, actor] = await Promise.all([getUserSession(), getCurrentAdminActor()]);
    const isOwner = Boolean(session?.email && session.email.toLowerCase() === reg.email.toLowerCase());
    const isStaff = Boolean(actor && (hasPermission(actor, "payments.view") || hasPermission(actor, "customers.view")));
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: session || actor ? "Forbidden" : "Please sign in." }, { status: session || actor ? 403 : 401 });
    }

    const inv = await ensureInvoice(reg.id);
    if (!inv) {
      return NextResponse.json(
        { error: reg.paid === "paid" ? "Nothing was charged for this booking, so there's no invoice." : "The invoice is issued once the booking is paid." },
        { status: 409 }
      );
    }
    const pdf = await renderInvoicePdf(inv);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoiceFileName(inv)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/invoices/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
