// Encryption at rest for secrets an admin uploads (e.g. the Swish certificate
// and private key). Server only.
//
// AES-256-GCM with a key derived from SECRETS_ENCRYPTION_KEY. A database dump
// on its own is therefore useless — the key lives only in the app's
// environment (Azure App Service → Configuration). Keep that value safe and
// stable: changing it makes previously uploaded secrets unreadable, and they
// must then be uploaded again.

import crypto from "node:crypto";

export class SecretsKeyMissingError extends Error {
  constructor() {
    super("SECRETS_ENCRYPTION_KEY is not set — add it to the server environment before uploading secrets.");
  }
}

const VERSION = "v1";

function encryptionKey(): Buffer {
  const configured = (process.env.SECRETS_ENCRYPTION_KEY ?? "").trim();
  if (configured) return crypto.createHash("sha256").update(configured).digest();
  // Local development only — never fall back to a guessable key in production.
  if (process.env.NODE_ENV !== "production") {
    return crypto.createHash("sha256").update("dev-only-secrets-key-set-SECRETS_ENCRYPTION_KEY").digest();
  }
  throw new SecretsKeyMissingError();
}

export function hasEncryptionKey() {
  return Boolean((process.env.SECRETS_ENCRYPTION_KEY ?? "").trim()) || process.env.NODE_ENV !== "production";
}

/** → "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
