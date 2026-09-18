"use client";

import { useEffect, useRef, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

type Meta = {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  uploadedAt: string;
  uploadedBy: string;
};

type Status = {
  source: "uploaded" | "env" | "none";
  meta: Meta | null;
  payeeAlias: string | null;
  warning?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Portal Settings → Swish Certificate. The bank-issued certificate and private
 * key are uploaded here instead of being copied onto the server; the API stores
 * them encrypted and only ever sends back public details.
 */
export function SwishCertificateCard() {
  const { can } = usePermissions();
  const editable = can("settings.edit");

  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const certRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [passphrase, setPassphrase] = useState("");

  useEffect(() => {
    fetch("/api/settings/swish-certificate")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Couldn't load the Swish certificate status");
        setStatus(j.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cert = certRef.current?.files?.[0];
    const key = keyRef.current?.files?.[0];
    if (!cert || !key) {
      setError("Choose both the certificate file and the private key file.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("certificate", cert);
      body.append("privateKey", key);
      if (passphrase) body.append("passphrase", passphrase);
      const res = await fetch("/api/settings/swish-certificate", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Upload failed");
      setStatus(j.data);
      setReplacing(false);
      setPassphrase("");
      if (certRef.current) certRef.current.value = "";
      if (keyRef.current) keyRef.current.value = "";
      setNotice("✓ Certificate uploaded — Swish payments now use it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove the uploaded Swish certificate? Swish payments stop working until a new one is uploaded.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/swish-certificate", { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't remove the certificate");
      setStatus((s) => ({ ...(s as Status), ...j.data }));
      setNotice("Certificate removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the certificate");
    } finally {
      setBusy(false);
    }
  }

  const meta = status?.meta;
  const daysLeft = meta ? Math.floor((new Date(meta.validTo).getTime() - Date.now()) / DAY) : null;
  const showForm = editable && (!meta || replacing);

  return (
    <div className="card">
      <div className="card-title">🔐 Swish Certificate</div>
      <p className="mb-3 text-[12px] text-muted">
        The merchant certificate from your bank that lets this site take Swish payments. It&apos;s stored
        encrypted — the private key can never be viewed or downloaded again after upload.
      </p>

      {!status && !error ? <div className="text-[13px] text-muted">Loading…</div> : null}

      {status && meta ? (
        <div className="mb-3 rounded-lg border border-line bg-cream/50 p-3 text-[13px]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="badge badge-ok">Active</span>
            {daysLeft !== null && daysLeft <= 30 ? (
              <span className="badge badge-warn">Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}</span>
            ) : null}
          </div>
          <Row k="Issued to" v={meta.subject} />
          <Row k="Issued by" v={meta.issuer} />
          <Row k="Valid" v={`${fmtDate(meta.validFrom)} → ${fmtDate(meta.validTo)}`} />
          <Row k="Fingerprint" v={`${meta.fingerprint.slice(0, 23)}…`} mono />
          <Row k="Uploaded" v={`${fmtDate(meta.uploadedAt)} by ${meta.uploadedBy}`} />
        </div>
      ) : null}

      {status && !meta ? (
        <div className="mb-3 rounded-lg border border-line bg-cream/50 p-3 text-[13px]">
          {status.source === "env" ? (
            <>
              <span className="badge badge-info">Using server files</span>
              <p className="mt-2 text-[12px] text-muted">
                No certificate uploaded — Swish is using the certificate files configured on the server
                (SWISH_CERT_PATH). Upload one here to manage it from the admin panel instead.
              </p>
            </>
          ) : (
            <>
              <span className="badge badge-danger">Not configured</span>
              <p className="mt-2 text-[12px] text-muted">Swish payments are unavailable until a certificate is uploaded.</p>
            </>
          )}
        </div>
      ) : null}

      {status?.warning ? <div className="mb-3 text-xs font-semibold text-warn">⚠️ {status.warning}</div> : null}

      {showForm ? (
        <form onSubmit={upload} className="flex flex-col gap-3">
          <div>
            <label className="field-label" htmlFor="swish-cert">
              Certificate file (.pem) *
            </label>
            <input id="swish-cert" ref={certRef} type="file" accept=".pem,.crt,.cer" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="swish-key">
              Private key file (.key / .pem) *
            </label>
            <input id="swish-key" ref={keyRef} type="file" accept=".key,.pem" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="swish-pass">
              Key password <span className="font-normal normal-case text-muted">(only if the key has one)</span>
            </label>
            <input
              id="swish-pass"
              type="password"
              autoComplete="off"
              className="field max-w-xs"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted">
            Both files are checked before saving: the key must belong to the certificate and the certificate
            must not be expired.
          </p>
          <div className="flex gap-2">
            <button className={`btn btn-primary ${busy ? "is-disabled" : ""}`} disabled={busy}>
              {busy ? "Uploading…" : meta ? "Replace Certificate" : "Upload Certificate"}
            </button>
            {replacing ? (
              <button type="button" className="btn btn-ghost" onClick={() => setReplacing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {editable && meta && !replacing ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setReplacing(true)} disabled={busy}>
            Replace Certificate
          </button>
          <button type="button" className="btn btn-ghost text-danger" onClick={remove} disabled={busy}>
            Remove
          </button>
        </div>
      ) : null}

      {!editable ? <div className="text-[12px] text-muted">You have view-only access to Portal Settings.</div> : null}
      {error ? <div className="mt-3 text-xs font-semibold text-danger">{error}</div> : null}
      {notice ? <div className="mt-3 text-xs font-semibold text-ok">{notice}</div> : null}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1 last:border-0">
      <span className="text-muted">{k}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-[11px]" : ""}`}>{v}</span>
    </div>
  );
}
