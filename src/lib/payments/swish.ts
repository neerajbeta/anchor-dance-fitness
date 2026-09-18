// Swish Handel (merchant) client — server only.
//
// Swish requires mutual TLS: every call is signed with the merchant certificate
// issued by the bank. The certificate is never stored in this repo. It comes
// from, in order:
//   1. Admin → Portal Settings → Swish Certificate (uploaded, encrypted in the DB)
//   2. SWISH_CERT_PATH / SWISH_KEY_PATH env vars (file paths or pasted PEM text)

import fs from "node:fs";
import https from "node:https";
import crypto from "node:crypto";
import { getSwishCertificate } from "@/lib/services";

export class SwishNotConfiguredError extends Error {
  constructor(message = "Swish is not configured on this server") {
    super(message);
  }
}

/** Swish rejects anything that isn't a payment request it can act on. */
export class SwishApiError extends Error {}

/** An uploaded certificate/key pair that can't be used. The message is safe to show an admin. */
export class SwishCertificateError extends Error {}

export type SwishStatus = "CREATED" | "PAID" | "DEBITED" | "DECLINED" | "ERROR" | "CANCELLED";

const API_PROD = "https://cpc.getswish.net/swish-cpcapi/api/v2";
const API_TEST = "https://mss.cpc.getswish.net/swish-cpcapi/api/v2";

/** Reads a PEM either inline (env holds the certificate text) or from a file. */
function readPem(value: string | undefined, label: string): Buffer {
  const raw = (value ?? "").trim();
  if (!raw) throw new SwishNotConfiguredError(`${label} is not set`);
  if (raw.includes("-----BEGIN")) return Buffer.from(raw.replace(/\\n/g, "\n"), "utf8");
  if (!fs.existsSync(raw)) throw new SwishNotConfiguredError(`${label} file not found: ${raw}`);
  return fs.readFileSync(raw);
}

type SwishCredentials = { cert: Buffer; key: Buffer; passphrase?: string; source: "uploaded" | "env" };

// The uploaded certificate is read from the DB and decrypted once, then reused
// for a minute so a busy checkout doesn't hit the DB on every Swish call.
let cached: { at: number; value: SwishCredentials | null } | null = null;
const CACHE_MS = 60_000;

/** Call after uploading or removing a certificate so the change applies immediately. */
export function clearSwishCredentialsCache() {
  cached = null;
}

async function uploadedCredentials(): Promise<SwishCredentials | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let value: SwishCredentials | null = null;
  try {
    const stored = await getSwishCertificate();
    if (stored) {
      value = {
        cert: Buffer.from(stored.cert, "utf8"),
        key: Buffer.from(stored.key, "utf8"),
        passphrase: stored.passphrase || undefined,
        source: "uploaded",
      };
    }
  } catch (err) {
    // No DB, or a secret that can't be decrypted (SECRETS_ENCRYPTION_KEY changed) — fall back to env.
    console.error("[swish] couldn't load the uploaded certificate:", err instanceof Error ? err.message : err);
  }
  cached = { at: Date.now(), value };
  return value;
}

function envCredentials(): SwishCredentials {
  return {
    cert: readPem(process.env.SWISH_CERT_PATH, "SWISH_CERT_PATH"),
    key: readPem(process.env.SWISH_KEY_PATH, "SWISH_KEY_PATH"),
    passphrase: process.env.SWISH_KEY_PASS || undefined,
    source: "env",
  };
}

export async function swishConfig() {
  const payeeAlias = (process.env.SWISH_PAYEE_ALIAS ?? "").trim();
  if (!payeeAlias) throw new SwishNotConfiguredError("SWISH_PAYEE_ALIAS is not set");
  const credentials = (await uploadedCredentials()) ?? envCredentials();
  return {
    payeeAlias,
    ...credentials,
    apiUrl: (process.env.SWISH_ENV ?? "production") === "test" ? API_TEST : API_PROD,
    /**
     * Safety valve for a live merchant number: when set, every request is
     * charged this amount instead of the real total (the PHP site calls this
     * "production demo mode"). Leave unset in production.
     */
    demoAmount: Number(process.env.SWISH_DEMO_AMOUNT ?? "") || null,
  };
}

/** Where the active certificate comes from, without reading any secret out. */
export async function swishCredentialSource(): Promise<"uploaded" | "env" | "none"> {
  if (await uploadedCredentials()) return "uploaded";
  try {
    envCredentials();
    return "env";
  } catch {
    return "none";
  }
}

const PEM_BLOCK = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]+?-----END \1-----/g;

/**
 * Checks an uploaded certificate + private key before they're saved: both parse,
 * the key belongs to the certificate, and the certificate is currently valid.
 * Returns the non-secret details shown in Portal Settings.
 */
export function inspectSwishCertificate(certPem: string, keyPem: string, passphrase?: string) {
  const blocks = certPem.match(PEM_BLOCK) ?? [];
  const certBlocks = blocks.filter((b) => b.includes("CERTIFICATE"));
  if (certBlocks.length === 0) {
    throw new SwishCertificateError(
      "The certificate file isn't a PEM certificate. Upload the .pem file (it starts with -----BEGIN CERTIFICATE-----)."
    );
  }
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(keyPem)) {
    throw new SwishCertificateError(
      "The key file isn't a PEM private key. Upload the .key/.pem file (it starts with -----BEGIN PRIVATE KEY-----)."
    );
  }

  let key: crypto.KeyObject;
  try {
    key = crypto.createPrivateKey({ key: keyPem, format: "pem", passphrase: passphrase || undefined });
  } catch {
    throw new SwishCertificateError(
      passphrase
        ? "The private key couldn't be opened — check the key password."
        : "The private key couldn't be opened. If it's password-protected, enter the key password."
    );
  }

  // A bundle may include the bank's intermediate certificates — use the one that matches the key.
  const certs = certBlocks.map((b) => new crypto.X509Certificate(b));
  const leaf = certs.find((c) => c.checkPrivateKey(key));
  if (!leaf) throw new SwishCertificateError("This private key doesn't belong to the uploaded certificate.");

  const validFrom = new Date(leaf.validFrom);
  const validTo = new Date(leaf.validTo);
  if (validTo.getTime() < Date.now()) {
    throw new SwishCertificateError(`This certificate expired on ${validTo.toISOString().slice(0, 10)}.`);
  }

  const cn = /CN=([^\n,]+)/.exec(leaf.subject)?.[1]?.trim() ?? leaf.subject;
  const issuer = /CN=([^\n,]+)/.exec(leaf.issuer)?.[1]?.trim() ?? leaf.issuer;
  return {
    subject: cn,
    issuer,
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    fingerprint: leaf.fingerprint256,
    // Swish issues the certificate to the merchant number — warn if it doesn't match the configured one.
    matchesPayeeAlias: !process.env.SWISH_PAYEE_ALIAS || cn.replace(/\D/g, "") === process.env.SWISH_PAYEE_ALIAS.replace(/\D/g, ""),
  };
}

/**
 * Where Swish posts the result. It must be public HTTPS, so a plain localhost
 * dev server has none unless SWISH_CALLBACK_URL points at a tunnel.
 */
export function swishCallbackUrl(origin: string) {
  const configured = (process.env.SWISH_CALLBACK_URL ?? "").trim();
  return configured || `${origin.replace(/\/$/, "")}/api/payments/swish/callback`;
}

export async function isSwishConfigured(origin?: string) {
  try {
    await swishConfig();
  } catch {
    return false;
  }
  return origin ? /^https:\/\//i.test(swishCallbackUrl(origin)) : true;
}

/** "070-123 45 67" / "+46701234567" → "46701234567". Returns null if not a Swedish mobile. */
export function normalisePayerAlias(input: string): string | null {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("46")) {
    // already international
  } else if (digits.startsWith("0")) {
    digits = `46${digits.slice(1)}`;
  } else {
    digits = `46${digits}`;
  }
  return /^467\d{8}$/.test(digits) ? digits : null;
}

/** Swish identifies a request by a 32-char hex id; the GET endpoint wants it UUID-dashed. */
function dashed(instructionId: string) {
  if (!/^[0-9a-f]{32}$/i.test(instructionId)) return instructionId;
  const s = instructionId.toUpperCase();
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type SwishResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

function call(
  url: string,
  method: "GET" | "PUT",
  payload: unknown,
  cfg: Awaited<ReturnType<typeof swishConfig>>
): Promise<SwishResponse> {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method,
        cert: cfg.cert,
        key: cfg.key,
        passphrase: cfg.passphrase,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        },
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("Swish request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function firstErrorMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]?.errorMessage) return String(parsed[0].errorMessage);
    if (parsed?.errorMessage) return String(parsed.errorMessage);
  } catch {
    /* not JSON — use the fallback */
  }
  return fallback;
}

export type CreateSwishInput = {
  /** SEK, whole kronor. */
  amount: number;
  /** Payer's Swedish mobile number — the Swish app prompt goes to this number. */
  phone: string;
  /** Our own reference, shown on the merchant statement (max 35 chars, alphanumeric). */
  payeeReference: string;
  /** Text the payer sees in the Swish app (max 50 chars). */
  message: string;
  /** Public HTTPS URL Swish posts the result to. */
  callbackUrl: string;
};

export async function createSwishPaymentRequest(input: CreateSwishInput) {
  const cfg = await swishConfig();
  const payerAlias = normalisePayerAlias(input.phone);
  if (!payerAlias) throw new SwishApiError("Enter a valid Swedish mobile number, e.g. 070 123 45 67.");
  if (!/^https:\/\//i.test(input.callbackUrl)) {
    throw new SwishNotConfiguredError("Swish callback URL must be a public HTTPS address");
  }

  const instructionId = crypto.randomBytes(16).toString("hex").toUpperCase();
  const amount = cfg.demoAmount ?? input.amount;

  const res = await call(
    `${cfg.apiUrl}/paymentrequests/${instructionId}`,
    "PUT",
    {
      payeePaymentReference: input.payeeReference.slice(0, 35),
      callbackUrl: input.callbackUrl,
      payeeAlias: cfg.payeeAlias,
      payerAlias,
      amount,
      currency: "SEK",
      message: input.message.slice(0, 50),
    },
    cfg
  );

  if (res.status !== 201) {
    throw new SwishApiError(firstErrorMessage(res.body, "Swish could not create the payment request."));
  }

  return {
    instructionId,
    amount,
    payeeAlias: cfg.payeeAlias,
    /** Opens the Swish app on the payer's phone (mobile browsers). */
    appLink: `swish://paymentrequest?token=${instructionId}`,
  };
}

export async function getSwishPaymentStatus(instructionId: string) {
  const cfg = await swishConfig();
  const res = await call(`${cfg.apiUrl}/paymentrequests/${encodeURIComponent(dashed(instructionId))}`, "GET", undefined, cfg);
  if (res.status !== 200) {
    throw new SwishApiError(firstErrorMessage(res.body, "Swish could not be reached."));
  }
  const body = JSON.parse(res.body) as { status?: string; payeePaymentReference?: string; errorMessage?: string };
  const status = String(body.status ?? "").toUpperCase() as SwishStatus;
  return {
    status,
    paid: status === "PAID" || status === "DEBITED",
    failed: status === "DECLINED" || status === "ERROR" || status === "CANCELLED",
    message: body.errorMessage ?? null,
  };
}
