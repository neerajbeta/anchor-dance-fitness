import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  deleteSwishCertificate,
  getSwishCertificateMeta,
  recordAuditLog,
  saveSwishCertificate,
  DbNotConfiguredError,
} from "@/lib/services";
import {
  clearSwishCredentialsCache,
  inspectSwishCertificate,
  swishCredentialSource,
  SwishCertificateError,
} from "@/lib/payments/swish";
import { SecretsKeyMissingError } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PEM certificates/keys are a few KB; anything bigger isn't one.
const MAX_FILE_BYTES = 64 * 1024;

/**
 * Swish certificate management for Portal Settings.
 *
 * GET    — status only: where the active certificate comes from and its public
 *          details (merchant number, expiry, fingerprint). Never the cert or key.
 * POST   — multipart upload: `certificate`, `privateKey`, optional `passphrase`.
 *          Validated, then stored encrypted.
 * DELETE — removes the uploaded certificate (falls back to env files, if any).
 */
export async function GET() {
  const auth = await requirePermission("settings.view");
  if (!auth.ok) return auth.response;
  try {
    const [meta, source] = await Promise.all([getSwishCertificateMeta(), swishCredentialSource()]);
    return NextResponse.json({
      data: { source, meta, payeeAlias: process.env.SWISH_PAYEE_ALIAS || null },
    });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const form = await req.formData();
    const certFile = form.get("certificate");
    const keyFile = form.get("privateKey");
    const passphrase = String(form.get("passphrase") ?? "").trim() || null;

    if (!(certFile instanceof File) || !(keyFile instanceof File)) {
      return NextResponse.json({ error: "Choose both the certificate file and the private key file." }, { status: 400 });
    }
    if (certFile.size > MAX_FILE_BYTES || keyFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Those files are too large to be a certificate and key." }, { status: 400 });
    }

    const cert = await certFile.text();
    const key = await keyFile.text();
    const details = inspectSwishCertificate(cert, key, passphrase ?? undefined);
    const { matchesPayeeAlias, ...publicDetails } = details;

    const meta = {
      ...publicDetails,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.actor.name,
    };
    await saveSwishCertificate({ cert, key, passphrase, meta });
    clearSwishCredentialsCache();

    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "swish_certificate.uploaded",
      module: "settings",
      targetType: "swish_certificate",
      targetId: meta.fingerprint,
      // Public certificate details only — never the key.
      newValues: { subject: meta.subject, validTo: meta.validTo, fingerprint: meta.fingerprint },
    });

    return NextResponse.json({
      data: {
        source: "uploaded",
        meta,
        payeeAlias: process.env.SWISH_PAYEE_ALIAS || null,
        warning: matchesPayeeAlias
          ? null
          : `This certificate is issued to ${meta.subject}, but the site's Swish number is ${process.env.SWISH_PAYEE_ALIAS}. Swish will reject payments until they match.`,
      },
    });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE() {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const old = await getSwishCertificateMeta();
    await deleteSwishCertificate();
    clearSwishCredentialsCache();
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "swish_certificate.removed",
      module: "settings",
      targetType: "swish_certificate",
      targetId: old?.fingerprint,
      oldValues: old ? { subject: old.subject, validTo: old.validTo, fingerprint: old.fingerprint } : undefined,
    });
    return NextResponse.json({ data: { source: await swishCredentialSource(), meta: null } });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof SwishCertificateError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof SecretsKeyMissingError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof DbNotConfiguredError) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  console.error("[api/settings/swish-certificate]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
