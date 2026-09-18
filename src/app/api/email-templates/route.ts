import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getAdminEmailRecipients,
  listEmailLog,
  listEmailTemplateOverrides,
  recordAuditLog,
  resetEmailTemplate,
  saveEmailTemplate,
  DbNotConfiguredError,
} from "@/lib/services";
import { EMAIL_TEMPLATES, templateDef } from "@/lib/email/defaults";
import { emailFrom, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITS = { subject: 200, heading: 200, body: 10_000, buttonLabel: 60, buttonUrl: 500 };

/**
 * Admin → Email Templates.
 * GET    — every template (admin's version or the default), sender status, recent sends.
 * PUT    — save one template.
 * DELETE — ?key=… restore the built-in default.
 */
export async function GET() {
  const auth = await requirePermission("settings.view");
  if (!auth.ok) return auth.response;
  try {
    const [overrides, log] = await Promise.all([listEmailTemplateOverrides(), listEmailLog(30)]);
    const adminRecipients = await getAdminEmailRecipients();
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    const templates = EMAIL_TEMPLATES.map((def) => {
      const o = byKey.get(def.key);
      return {
        key: def.key,
        name: def.name,
        icon: def.icon,
        trigger: def.trigger,
        audience: def.audience,
        variables: def.variables,
        defaults: def.defaults,
        content: o
          ? {
              subject: o.subject,
              heading: o.heading,
              body: o.body,
              buttonLabel: o.buttonLabel,
              buttonUrl: o.buttonUrl,
              enabled: o.enabled,
            }
          : def.defaults,
        customised: Boolean(o),
        updatedAt: o?.updatedAt ?? null,
        updatedBy: o?.updatedBy ?? null,
      };
    });
    return NextResponse.json({
      data: { templates, configured: isEmailConfigured(), from: emailFrom(), log, adminRecipients },
    });
  } catch (err) {
    return handle(err);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const def = templateDef(String(b.key ?? ""));
    if (!def) return NextResponse.json({ error: "Unknown template." }, { status: 400 });

    const str = (k: keyof typeof LIMITS) => String(b[k] ?? "").trim();
    const input = {
      subject: str("subject"),
      heading: str("heading"),
      body: str("body"),
      buttonLabel: str("buttonLabel") || null,
      buttonUrl: str("buttonUrl") || null,
    };
    if (!input.subject || !input.heading || !input.body) {
      return NextResponse.json({ error: "Subject, heading and message are required." }, { status: 400 });
    }
    for (const [k, max] of Object.entries(LIMITS)) {
      const v = input[k as keyof typeof input];
      if (v && v.length > max) {
        return NextResponse.json({ error: `${k} is too long (max ${max} characters).` }, { status: 400 });
      }
    }
    if (input.buttonLabel && !input.buttonUrl) {
      return NextResponse.json({ error: "Add a link for the button, or clear the button text." }, { status: 400 });
    }
    if (input.buttonUrl && !/^(\{\{\s*[a-z_]+\s*\}\}|https?:\/\/|mailto:)/i.test(input.buttonUrl)) {
      return NextResponse.json(
        { error: "The button link must start with https:// (or be a variable like {{portal_url}})." },
        { status: 400 }
      );
    }
    const allowed = new Set(def.variables.map((v) => v.name));
    const unknown = Array.from(
      `${input.subject} ${input.heading} ${input.body} ${input.buttonLabel ?? ""} ${input.buttonUrl ?? ""}`.matchAll(
        /\{\{\s*([a-z_]+)\s*\}\}/g
      ),
      (m) => m[1]
    ).filter((n) => !allowed.has(n));
    if (unknown.length) {
      return NextResponse.json(
        { error: `Unknown variable${unknown.length > 1 ? "s" : ""}: ${Array.from(new Set(unknown)).map((n) => `{{${n}}}`).join(", ")}` },
        { status: 400 }
      );
    }

    const row = await saveEmailTemplate({
      key: def.key,
      ...input,
      enabled: b.enabled !== false,
      updatedBy: auth.actor.name,
    });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "email_template.updated",
      module: "settings",
      targetType: "email_template",
      targetId: def.key,
      newValues: { subject: row.subject, enabled: row.enabled },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const def = templateDef(req.nextUrl.searchParams.get("key") ?? "");
    if (!def) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
    await resetEmailTemplate(def.key);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "email_template.reset",
      module: "settings",
      targetType: "email_template",
      targetId: def.key,
    });
    return NextResponse.json({ data: { key: def.key, content: def.defaults } });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  console.error("[api/email-templates]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
