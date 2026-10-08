"use client";

import { useEffect, useState } from "react";
import {
  CONSENT_ITEMS,
  CONSENT_NOTE,
  CONSENT_TITLE,
  EMPTY_CONSENT,
  PRIVACY_EMAIL,
  type ConsentChoices,
  type ConsentKey,
} from "@/lib/consent";

type Status = {
  consented: boolean;
  needsRenewal: boolean;
  givenAt: string | null;
  version: string | null;
  choices: ConsentChoices;
};

function niceDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "Privacy & consent" in My Portal: each permission on its own row, with the
 * optional ones (photos, videos, promotional use) switchable at any time. The
 * required one is shown but can't be turned off here — that's an account
 * deletion request, which goes to the studio by email.
 */
export function PrivacyConsentCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<ConsentKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my-consent", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setStatus(j.data ?? null))
      .catch(() => {});
  }, []);

  async function save(key: ConsentKey, choices: ConsentChoices) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/my-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save that");
      setStatus(j.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: ConsentKey) {
    const current = status?.choices ?? EMPTY_CONSENT;
    const next = { ...current, [key]: !current[key] };
    // Promotional use needs a photo or a video to apply to.
    if ((key === "photo" || key === "video") && !next.photo && !next.video) next.promo = false;
    if (key === "promo" && next.promo && !next.photo && !next.video) {
      next.photo = true;
      next.video = true;
    }
    save(key, next);
  }

  if (!status) return null;
  const given = niceDate(status.givenAt);

  return (
    <div className="surface-card mb-5 p-5 md:p-6">
      <div className="mb-1 font-display text-sm font-bold text-copy">🔒 {CONSENT_TITLE}</div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-copy-dim">
        {status.consented && given ? (
          <span className="rounded-full bg-ok/10 px-2.5 py-1 font-semibold text-[#1f6e4b] dark:text-emerald-300">
            ✓ Last updated {given}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {status.needsRenewal ? "Our wording has been updated — please review below" : "Not confirmed yet"}
          </span>
        )}
        {status.version ? <span>Version {status.version}</span> : null}
      </div>

      <div className="mt-3 divide-y divide-hairline rounded-[14px] border border-hairline">
        {CONSENT_ITEMS.map((item) => {
          const on = status.choices[item.key];
          return (
            <div key={item.key} className="flex flex-wrap items-start justify-between gap-3 p-3.5">
              <div className="min-w-0 flex-1 text-[13px]">
                <div className="font-semibold text-copy">
                  {item.title}
                  {item.required ? <span className="ml-1 text-[11px] font-normal text-copy-dim">· required</span> : null}
                </div>
                <div className="mt-0.5 text-[12px] leading-5 text-copy-dim">{item.text}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-[12px] font-semibold ${on ? "text-[#1f6e4b] dark:text-emerald-300" : "text-copy-dim"}`}
                >
                  {on ? "Allowed" : "Not allowed"}
                </span>
                {item.required ? null : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => toggle(item.key)}
                    className={`btn btn-sm text-[12px] ${on ? "btn-ghost" : "btn-grape"}`}
                  >
                    {busy === item.key ? "Saving…" : on ? "Withdraw" : "Allow"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className="mt-2 text-[12px] font-semibold text-danger">{error}</div>}

      <p className="mt-3 text-[11px] leading-5 text-copy-dim">{CONSENT_NOTE}</p>
      <p className="mt-1 text-[11px] text-copy-dim">
        To correct or delete your data, email{" "}
        <a className="font-semibold text-accent" href={`mailto:${PRIVACY_EMAIL}`}>
          {PRIVACY_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
