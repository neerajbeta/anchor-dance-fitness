import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { claimEmailLog, finishEmailLog, DbNotConfiguredError } from "@/lib/services";
import { sampleVariables, templateDef } from "@/lib/email/defaults";
import { renderEmail, type DetailRow } from "@/lib/email/render";
import { deliver, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_DETAILS: DetailRow[] = [
  ["Booking ID", "REG-1042"],
  ["Booking", "Bollywood Beginners · 18:00–19:00"],
  ["Dates", "1 Oct 2026 – 31 Dec 2026"],
  ["Location", "Stockholm"],
  ["Amount", "SEK 1 800"],
  ["Payment", "Paid · Swish"],
];

/**
 * Sends the template as it is in the editor (saved or not), filled with sample
 * values, to the signed-in admin's own address — so a test can't be used to
 * email anyone else.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = (await req.json()) as Record<string, string | null | undefined>;
    const def = templateDef(String(b.key ?? ""));
    if (!def) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Email sending isn't set up — add POSTMARK_SERVER_TOKEN to the server settings." },
        { status: 503 }
      );
    }
    const to = auth.actor.email;
    const email = renderEmail(
      {
        subject: `[TEST] ${b.subject ?? def.defaults.subject}`,
        heading: b.heading ?? def.defaults.heading,
        body: b.body ?? def.defaults.body,
        buttonLabel: b.buttonLabel ?? null,
        buttonUrl: b.buttonUrl ?? null,
      },
      { ...sampleVariables(def), name: auth.actor.name, first_name: auth.actor.name.split(/\s+/)[0], email: to },
      SAMPLE_DETAILS
    );

    const log = await claimEmailLog({ templateKey: def.key, toEmail: to, subject: email.subject });
    try {
      await deliver(to, email, `test-${def.key}`);
      if (log) await finishEmailLog(log.id, "sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (log) await finishEmailLog(log.id, "failed", message);
      return NextResponse.json({ error: `Postmark: ${message}` }, { status: 502 });
    }
    return NextResponse.json({ data: { to } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    console.error("[api/email-templates/test]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
