// Sends templated emails through Postmark (REST, no SDK). Server only.
// Never throws: a failed email must not fail a signup or a paid booking —
// it's recorded in email_log instead, where admins can see it.

import { claimEmailLog, finishEmailLog, getEmailTemplateOverride } from "@/lib/services";
import { templateDef, type EmailTemplateContent, type EmailTemplateKey } from "./defaults";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  EMAIL_LOGO_CID,
  EMAIL_LOGO_PATH,
  renderEmail,
  type DetailRow,
  type EmailVars,
  type RenderedEmail,
} from "./render";

const POSTMARK_URL = "https://api.postmarkapp.com/email";
const DEFAULT_FROM = "Anchor Dance & Fitness <noreply@anchorcricket.com>";

export type SendOutcome = "sent" | "failed" | "logged" | "duplicate" | "disabled";

export function isEmailConfigured() {
  return Boolean(process.env.POSTMARK_SERVER_TOKEN?.trim());
}

export function emailFrom() {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/** The admin's version of a template, or the built-in default. */
export async function loadTemplate(key: EmailTemplateKey): Promise<EmailTemplateContent> {
  const def = templateDef(key);
  if (!def) throw new Error(`Unknown email template "${key}"`);
  const row = await getEmailTemplateOverride(key);
  return row
    ? {
        subject: row.subject,
        heading: row.heading,
        body: row.body,
        buttonLabel: row.buttonLabel,
        buttonUrl: row.buttonUrl,
        enabled: row.enabled,
      }
    : def.defaults;
}

let logoBase64: Promise<string | null> | null = null;

/** The header logo (public/email/logo.png), read once and cached. */
function emailLogo() {
  logoBase64 ??= readFile(path.join(process.cwd(), "public", EMAIL_LOGO_PATH))
    .then((b) => b.toString("base64"))
    .catch((err) => {
      console.error("[email] logo missing — emails go out without it:", err.message);
      return null;
    });
  return logoBase64;
}

export type EmailAttachment = { name: string; content: Buffer; contentType: string };

/** Delivers one already-rendered email. Throws with Postmark's message on failure. */
export async function deliver(to: string, email: RenderedEmail, tag?: string, files: EmailAttachment[] = []) {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (!token) return false; // not configured — caller logs it instead
  const logo = email.html.includes(`cid:${EMAIL_LOGO_CID}`) ? await emailLogo() : null;
  const attachments = [
    ...(logo ? [{ Name: "logo.png", Content: logo, ContentType: "image/png", ContentID: `cid:${EMAIL_LOGO_CID}` }] : []),
    ...files.map((f) => ({ Name: f.name, Content: f.content.toString("base64"), ContentType: f.contentType })),
  ];
  const res = await fetch(POSTMARK_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: emailFrom(),
      To: to,
      Subject: email.subject,
      HtmlBody: email.html,
      TextBody: email.text,
      ReplyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
      Tag: tag,
      // The logo travels inside the email, so it shows even before images from
      // the web are allowed and in local dev. Plus any files (e.g. the invoice PDF).
      Attachments: attachments.length ? attachments : undefined,
      MessageStream: "outbound",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { Message?: string };
    throw new Error(j.Message || `Postmark responded ${res.status}`);
  }
  return true;
}

/**
 * Puts admin-written text (e.g. a bulk message) into the template itself
 * before rendering, so its blank lines, "- " bullets and **bold** are
 * formatted like the template's own text. The text may use the template's own
 * variables too (e.g. {{first_name}}), filled in per recipient.
 */
export function expandTemplate(tpl: EmailTemplateContent, blocks: Record<string, string>): EmailTemplateContent {
  const sub = (s: string) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, name: string) => (name in blocks ? blocks[name] : m));
  return { ...tpl, subject: sub(tpl.subject).replace(/\s+/g, " "), heading: sub(tpl.heading).replace(/\s+/g, " "), body: sub(tpl.body) };
}

/**
 * Sends one template to many people with Postmark's batch API (500 per call).
 * Each recipient gets their own copy with their own name. Returns how many
 * were accepted and how many failed. Without a Postmark token nothing is sent
 * (`configured: false`).
 */
export async function sendBatch(opts: {
  key: EmailTemplateKey;
  recipients: { email: string; vars: EmailVars }[];
  blocks?: Record<string, string>;
}): Promise<{ configured: boolean; sent: number; failed: number; errors: string[] }> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  let tpl = await loadTemplate(opts.key);
  if (opts.blocks) tpl = expandTemplate(tpl, opts.blocks);
  if (!token) {
    console.info(`[email] (no POSTMARK_SERVER_TOKEN — not sent) ${opts.key} → ${opts.recipients.length} recipients`);
    return { configured: false, sent: 0, failed: 0, errors: [] };
  }
  const logo = await emailLogo();
  const stream = process.env.POSTMARK_BULK_STREAM?.trim() || "outbound";
  let sent = 0,
    failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < opts.recipients.length; i += 500) {
    const chunk = opts.recipients.slice(i, i + 500);
    const messages = chunk.map((r) => {
      const email = renderEmail(tpl, r.vars);
      return {
        From: emailFrom(),
        To: r.email,
        Subject: email.subject,
        HtmlBody: email.html,
        TextBody: email.text,
        ReplyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
        Tag: opts.key,
        Attachments:
          logo && email.html.includes(`cid:${EMAIL_LOGO_CID}`)
            ? [{ Name: "logo.png", Content: logo, ContentType: "image/png", ContentID: `cid:${EMAIL_LOGO_CID}` }]
            : undefined,
        MessageStream: stream,
      };
    });
    try {
      const res = await fetch(`${POSTMARK_URL}/batch`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(60_000),
      });
      const j = (await res.json().catch(() => null)) as { ErrorCode: number; Message: string; To?: string }[] | { Message?: string } | null;
      if (!res.ok || !Array.isArray(j)) {
        failed += chunk.length;
        errors.push((j as { Message?: string } | null)?.Message || `Postmark responded ${res.status}`);
        continue;
      }
      for (const r of j) {
        if (r.ErrorCode === 0) sent++;
        else {
          failed++;
          if (errors.length < 5) errors.push(`${r.To ?? ""}: ${r.Message}`);
        }
      }
    } catch (err) {
      failed += chunk.length;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { configured: true, sent, failed, errors };
}

/**
 * Renders a template and sends it, once per `dedupeKey`. Without a Postmark
 * token (local dev) the email is only logged to the console.
 */
export async function sendTemplateEmail(opts: {
  key: EmailTemplateKey;
  to: string;
  vars: EmailVars;
  details?: DetailRow[];
  dedupeKey?: string;
  attachments?: EmailAttachment[];
}): Promise<SendOutcome> {
  const to = opts.to.trim().toLowerCase();
  let logId: string | null = null;
  try {
    const tpl = await loadTemplate(opts.key);
    if (!tpl.enabled) return "disabled";
    const email = renderEmail(tpl, opts.vars, opts.details);

    const claim = await claimEmailLog({
      templateKey: opts.key,
      toEmail: to,
      subject: email.subject,
      dedupeKey: opts.dedupeKey,
    });
    if (!claim) return "duplicate";
    logId = claim.id;

    const sent = await deliver(to, email, opts.key, opts.attachments);
    if (!sent) {
      console.info(`[email] (no POSTMARK_SERVER_TOKEN — not sent) ${opts.key} → ${to}: ${email.subject}`);
      await finishEmailLog(logId, "logged");
      return "logged";
    }
    await finishEmailLog(logId, "sent");
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${opts.key} → ${to} failed:`, message);
    if (logId) await finishEmailLog(logId, "failed", message).catch(() => {});
    return "failed";
  }
}
