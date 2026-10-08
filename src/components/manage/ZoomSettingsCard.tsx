"use client";

import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

type Settings = {
  accountId: string;
  clientId: string;
  hostUser: string;
  autoCreate: boolean;
  waitingRoom: boolean;
  muteOnEntry: boolean;
  hasSecret: boolean;
  source: "settings" | "env" | "none";
};

/** Zoom Server-to-Server OAuth connection for online classes. */
export function ZoomSettingsCard() {
  const { can } = usePermissions();
  const editable = can("settings.edit");
  const [s, setS] = useState<Settings | null>(null);
  const [configured, setConfigured] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    setWaited(0);
    // Counts up while we wait, so a slow answer never looks like a frozen card.
    const started = Date.now();
    const tick = setInterval(() => setWaited(Math.round((Date.now() - started) / 1000)), 1000);
    // Some browsers don't have AbortSignal.timeout — fall back to a manual abort.
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/zoom", { cache: "no-store", signal: controller.signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.data) throw new Error(j.error || `Couldn't load the Zoom settings (${res.status})`);
      setS(j.data.settings);
      setConfigured(j.data.configured);
    } catch (err) {
      // Don't leave the card on "Loading…" — say what went wrong and offer a retry.
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      setLoadError(
        timedOut
          ? "The server took too long to answer (15s). This is usually the database connection — try again."
          : err instanceof Error
          ? err.message
          : "Couldn't load the Zoom settings"
      );
    } finally {
      clearInterval(tick);
      clearTimeout(abort);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method: "PUT" | "POST", body: object, key: string) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch("/api/zoom", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setMsg({ ok: true, text: j.data?.message ?? "✓ Saved" });
      if (key === "save") setSecret("");
      await load();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveAndTest() {
    if (!s) return;
    const ok = await call("PUT", { ...s, clientSecret: secret }, "save");
    if (ok && (secret || s.hasSecret)) await call("POST", { action: "test" }, "test");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="card-title">🎥 Zoom — online classes</div>
        <span className={`badge ${configured ? "badge-ok" : "badge-gray"}`}>{configured ? "● Connected" : "Not connected"}</span>
      </div>
      <p className="-mt-1 mb-3 text-[12px] text-muted">
        Every <strong>online class</strong> gets its own recurring Zoom meeting — created, updated and deleted with the class. Only
        students who booked the class see the link (My Portal, confirmation email, calendar). Use a Zoom{" "}
        <strong>Server-to-Server OAuth</strong> app (marketplace.zoom.us → Develop → Build App) with the scopes{" "}
        <code>meeting:write:meeting:admin</code>, <code>meeting:update:meeting:admin</code>, <code>meeting:delete:meeting:admin</code>,{" "}
        <code>meeting:read:meeting:admin</code> and <code>user:read:user:admin</code> (older accounts: <code>meeting:write:admin</code>,{" "}
        <code>meeting:read:admin</code>, <code>user:read:admin</code>).
      </p>
      {loadError && !s ? (
        <div className="rounded-lg bg-danger/10 p-3 text-[12px]">
          <div className="font-semibold text-danger">{loadError}</div>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={load}>
            ↻ Try again
          </button>
        </div>
      ) : !s ? (
        <div className="text-[12px] text-muted">
          Loading…{waited >= 3 ? ` (${waited}s — the database is answering slowly)` : ""}
        </div>
      ) : (
        <>
          {s.source === "env" && (
            <div className="mb-3 rounded-lg bg-cream/60 px-3 py-2 text-[12px] text-slate">Using the ZOOM_* values from the server environment. Saving here overrides them.</div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Account ID *</label>
              <input className="field" value={s.accountId} disabled={!editable} onChange={(e) => setS({ ...s, accountId: e.target.value })} placeholder="From the app's App Credentials" />
            </div>
            <div>
              <label className="field-label">Client ID *</label>
              <input className="field" value={s.clientId} disabled={!editable} onChange={(e) => setS({ ...s, clientId: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Client Secret *</label>
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={secret}
                disabled={!editable}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={s.hasSecret ? "•••••••• saved — type to replace" : "Paste the client secret"}
              />
              <p className="mt-1 text-[11px] text-muted">Stored encrypted. It&apos;s never shown again.</p>
            </div>
            <div>
              <label className="field-label">Host (Zoom user email)</label>
              <input className="field" value={s.hostUser} disabled={!editable} onChange={(e) => setS({ ...s, hostUser: e.target.value })} placeholder="me = the account owner" />
              <p className="mt-1 text-[11px] text-muted">Meetings are created under this licensed Zoom user.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.autoCreate} disabled={!editable} onChange={(e) => setS({ ...s, autoCreate: e.target.checked })} />
              Create a Zoom meeting automatically when an online class is added
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.waitingRoom} disabled={!editable} onChange={(e) => setS({ ...s, waitingRoom: e.target.checked })} />
              Waiting room (the coach lets students in)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.muteOnEntry} disabled={!editable} onChange={(e) => setS({ ...s, muteOnEntry: e.target.checked })} />
              Mute students when they join
            </label>
          </div>
          {msg && <div className={`mt-3 text-xs font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</div>}
          {editable && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={`btn btn-primary btn-sm ${busy ? "is-disabled" : ""}`} disabled={Boolean(busy) || !s.accountId.trim() || !s.clientId.trim() || (!secret && !s.hasSecret)} onClick={saveAndTest}>
                {busy === "save" ? "Saving…" : busy === "test" ? "Testing…" : "Save & test connection"}
              </button>
              {configured && (
                <button className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => call("POST", { action: "test" }, "test")}>
                  Test connection
                </button>
              )}
              {s.source === "settings" && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={Boolean(busy)}
                  onClick={() => confirm("Disconnect Zoom? New online classes won't get meetings. Existing links keep working.") && call("POST", { action: "disconnect" }, "disconnect")}
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
