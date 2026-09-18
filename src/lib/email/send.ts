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

/** Delivers one already-rendered email. Throws with Postmark's message on failure. */
export async function deliver(to: string, email: RenderedEmail, tag?: string) {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (!token) return false; // not configured — caller logs it instead
  const logo = email.html.includes(`cid:${EMAIL_LOGO_CID}`) ? await emailLogo() : null;
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
      // the web are allowed and in local dev.
      Attachments: logo
        ? [{ Name: "logo.png", Content: logo, ContentType: "image/png", ContentID: `cid:${EMAIL_LOGO_CID}` }]
        : undefined,
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
 * Renders a template and sends it, once per `dedupeKey`. Without a Postmark
 * token (local dev) the email is only logged to the console.
 */
export async function sendTemplateEmail(opts: {
  key: EmailTemplateKey;
  to: string;
  vars: EmailVars;
  details?: DetailRow[];
  dedupeKey?: string;
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

    const sent = await deliver(to, email, opts.key);
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
