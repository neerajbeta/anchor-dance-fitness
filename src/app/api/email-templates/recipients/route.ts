import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getAdminEmailRecipients,
  recordAuditLog,
  setAdminEmailRecipients,
  DbNotConfiguredError,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_RECIPIENTS = 10;

/** PUT { emails: "a@x.se, b@y.se" } — who gets the "new booking" email. Empty = use EMAIL_ADMIN_TO. */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = (await req.json()) as { emails?: string };
    const emails = Array.from(
      new Set(
        String(b.emails ?? "")
          .split(/[,;\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const bad = emails.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) {
      return NextResponse.json({ error: `Not a valid email: ${bad.join(", ")}` }, { status: 400 });
    }
    if (emails.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Up to ${MAX_RECIPIENTS} addresses.` }, { status: 400 });
    }
    const old = await getAdminEmailRecipients();
    await setAdminEmailRecipients(emails);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "email_admin_recipients.updated",
      module: "settings",
      targetType: "email_template",
      targetId: "admin_booking",
      oldValues: { emails: old.emails },
      newValues: { emails },
    });
    return NextResponse.json({ data: await getAdminEmailRecipients() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    console.error("[api/email-templates/recipients]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
