import type { EmailTemplateContent } from "./defaults";

/**
 * Turns a template + variables into a branded HTML email (and a plain-text
 * twin). Pure and dependency-free so the admin editor can use it for a live
 * preview on the client.
 *
 * Template syntax, kept deliberately small so non-technical admins can edit it:
 *   {{variable}}          replaced with the value (HTML-escaped)
 *   **bold**              bold text
 *   blank line            new paragraph
 *   lines starting "- "   bullet list
 *   {{booking_details}}   on its own line: a formatted table of the booking
 */

export type EmailVars = Record<string, string | null | undefined>;
export type DetailRow = [label: string, value: string];

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Where the header logo comes from. Real emails embed it as an inline
 * attachment (cid:, see send.ts) so it shows in every inbox without loading
 * anything from our server; the admin preview uses the public file.
 */
export const EMAIL_LOGO_CID = "anchor-logo";
export const EMAIL_LOGO_PATH = "/email/logo.png";

const BRAND = {
  gradient: "linear-gradient(135deg,#F7942E 0%,#EF5B2B 52%,#E63E2B 100%)",
  solid: "#EF5B2B",
  ink: "#211A16",
  body: "#4A4039",
  muted: "#93887D",
  line: "#ECE4DA",
  cream: "#FBF8F4",
};

const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Plain-text substitution (subject lines, URLs, the text version). */
export function fillText(template: string, vars: EmailVars) {
  return template.replace(VAR_RE, (_, name: string) => (name === "booking_details" ? "" : vars[name] ?? ""));
}

/** Escapes the admin's text, then fills variables (escaped too) and **bold**. */
function inlineHtml(template: string, vars: EmailVars) {
  return escapeHtml(template)
    .replace(VAR_RE, (_, name: string) => escapeHtml(vars[name] ?? ""))
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${BRAND.ink}">$1</strong>`)
    .replace(/\n/g, "<br>");
}

function detailsTableHtml(rows: DetailRow[]) {
  const shown = rows.filter(([, v]) => v && v.trim());
  if (!shown.length) return "";
  const trs = shown
    .map(
      ([label, value], i) => `<tr>
  <td style="padding:10px 14px;font:600 12px ${FONT};color:${BRAND.muted};text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;vertical-align:top;${i ? `border-top:1px solid ${BRAND.line};` : ""}">${escapeHtml(label)}</td>
  <td style="padding:10px 14px;font:600 14px ${FONT};color:${BRAND.ink};${i ? `border-top:1px solid ${BRAND.line};` : ""}">${escapeHtml(value)}</td>
</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${BRAND.line};border-radius:12px;border-collapse:separate;background:${BRAND.cream};">${trs}</table>`;
}

function bodyHtml(body: string, vars: EmailVars, details: DetailRow[]) {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^\{\{\s*booking_details\s*\}\}$/.test(block)) return detailsTableHtml(details);
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 6px;">${inlineHtml(l.replace(/^\s*[-•]\s+/, ""), vars)}</li>`)
          .join("");
        return `<ul style="margin:0 0 16px;padding-left:22px;font:15px/1.6 ${FONT};color:${BRAND.body};">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px;font:15px/1.65 ${FONT};color:${BRAND.body};">${inlineHtml(block, vars)}</p>`;
    })
    .join("\n")
    // Bullets separated by blank lines are still one list.
    .replace(/<\/ul>\n<ul[^>]*>/g, "");
}

function bodyText(body: string, vars: EmailVars, details: DetailRow[]) {
  const table = details
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return body
    .replace(/\r\n/g, "\n")
    .replace(/^[ \t]*\{\{\s*booking_details\s*\}\}[ \t]*$/m, table)
    .replace(VAR_RE, (_, name: string) => vars[name] ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

/** Only http(s)/mailto links make it into a button. */
function safeUrl(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : "";
}

export function renderEmail(
  tpl: Pick<EmailTemplateContent, "subject" | "heading" | "body" | "buttonLabel" | "buttonUrl">,
  vars: EmailVars,
  details: DetailRow[] = [],
  opts: { logoSrc?: string } = {}
): RenderedEmail {
  const logoSrc = opts.logoSrc ?? `cid:${EMAIL_LOGO_CID}`;
  const siteName = vars.site_name || "Anchor Dance & Fitness";
  const subject = fillText(tpl.subject, vars).replace(/\s+/g, " ").trim();
  const heading = inlineHtml(tpl.heading, vars);
  const buttonLabel = tpl.buttonLabel ? fillText(tpl.buttonLabel, vars).trim() : "";
  const buttonUrl = tpl.buttonUrl ? safeUrl(fillText(tpl.buttonUrl, vars)) : "";
  const year = new Date().getFullYear();

  const button =
    buttonLabel && buttonUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="border-radius:999px;background:${BRAND.solid};background-image:${BRAND.gradient};">
  <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:13px 28px;font:700 15px ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(buttonLabel)} →</a>
</td></tr></table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4EEE6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEE6;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td align="center" style="border-radius:18px 18px 0 0;background:#ffffff;padding:26px 28px 20px;border:1px solid ${BRAND.line};border-bottom:0;">
      <img src="${escapeHtml(logoSrc)}" width="240" alt="${escapeHtml(siteName)}" style="display:block;width:240px;max-width:80%;height:auto;border:0;outline:none;text-decoration:none;font:800 18px ${FONT};color:${BRAND.ink};">
    </td></tr>
    <tr><td style="height:5px;line-height:5px;font-size:0;background:${BRAND.solid};background-image:${BRAND.gradient};">&nbsp;</td></tr>
    <tr><td style="background:#ffffff;padding:32px 28px 26px;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line};">
      <h1 style="margin:0 0 18px;font:800 24px/1.3 ${FONT};color:${BRAND.ink};">${heading}</h1>
      ${bodyHtml(tpl.body, vars, details)}
      ${button}
    </td></tr>
    <tr><td style="background:${BRAND.ink};border-radius:0 0 18px 18px;padding:18px 28px;text-align:center;">
      <div style="font:12px/1.6 ${FONT};color:rgba(255,255,255,.7);">${escapeHtml(vars.footer_note || `You're receiving this because you have an account with ${siteName}.`)}</div>
      <div style="font:12px/1.6 ${FONT};color:rgba(255,255,255,.45);">© ${year} ${escapeHtml(siteName)}</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    fillText(tpl.heading, vars),
    "",
    bodyText(tpl.body, vars, details),
    buttonLabel && buttonUrl ? `\n${buttonLabel}: ${buttonUrl}` : "",
    `\n— ${siteName}`,
  ].join("\n");

  return { subject, html, text };
}
