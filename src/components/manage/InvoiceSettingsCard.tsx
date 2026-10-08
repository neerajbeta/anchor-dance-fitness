"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

type Seller = {
  businessName: string;
  orgNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  footerNote: string;
};

const FIELDS: { key: keyof Seller; label: string; placeholder: string; wide?: boolean; multiline?: boolean }[] = [
  { key: "businessName", label: "Business name *", placeholder: "Anchor Dance & Fitness" },
  { key: "orgNumber", label: "Organisation number", placeholder: "559123-4567" },
  { key: "vatNumber", label: "VAT number", placeholder: "SE559123456701" },
  { key: "email", label: "Email", placeholder: "info@anchorfitness.se" },
  { key: "phone", label: "Phone", placeholder: "070 123 45 67" },
  { key: "website", label: "Website", placeholder: "anchorfitness.se" },
  { key: "address", label: "Address (one line per row)", placeholder: "Street 1\n191 00 Sollentuna\nSweden", wide: true, multiline: true },
  { key: "footerNote", label: "Footer message", placeholder: "Thank you for dancing with us!", wide: true },
];

/** Business details printed on invoices. Changes apply to invoices issued from now on. */
export function InvoiceSettingsCard() {
  const { can } = usePermissions();
  const editable = can("settings.edit");
  const [seller, setSeller] = useState<Seller | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/invoice-settings")
      .then((r) => r.json())
      .then((j) => setSeller(j.data ?? null))
      .catch(() => {});
  }, []);

  async function save() {
    if (!seller) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invoice-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seller) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      setSeller(j.data);
      setMsg({ ok: true, text: "✓ Saved — used on invoices issued from now on." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4">
      <div className="card-title">🧾 Invoice details</div>
      <p className="-mt-1 mb-3 text-[12px] text-muted">
        Printed on every invoice. An invoice is issued automatically when a booking is paid, attached to the confirmation email, and
        downloadable from My Portal. Issued invoices keep the details they were issued with.
      </p>
      {!seller ? (
        <div className="text-[12px] text-muted">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-3" : ""}>
                <label className="field-label">{f.label}</label>
                {f.multiline ? (
                  <textarea className="field" rows={3} value={seller[f.key]} placeholder={f.placeholder} disabled={!editable} onChange={(e) => setSeller({ ...seller, [f.key]: e.target.value })} />
                ) : (
                  <input className="field" value={seller[f.key]} placeholder={f.placeholder} disabled={!editable} onChange={(e) => setSeller({ ...seller, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
          {msg && <div className={`mt-3 text-xs font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</div>}
          {editable && (
            <button className={`btn btn-primary mt-3 ${busy ? "is-disabled" : ""}`} disabled={busy || !seller.businessName.trim()} onClick={save}>
              {busy ? "Saving…" : "Save invoice details"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
