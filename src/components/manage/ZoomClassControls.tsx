"use client";

import { useState } from "react";

export type ZoomClassInfo = {
  id: string;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomPassword: string | null;
  zoomSyncedAt: string | null;
  zoomError: string | null;
};

/** Zoom status + actions for one online class in Admin → Classes. */
export function ZoomClassControls({
  classId,
  info,
  configured,
  onChange,
}: {
  classId: string;
  info: ZoomClassInfo | undefined;
  configured: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [url, setUrl] = useState("");
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);

  async function act(action: string, extra: object = {}) {
    setBusy(action);
    try {
      const res = await fetch(`/api/zoom/classes/${classId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.error || "Zoom request failed");
        return null;
      }
      return j.data;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    const d = await act("start");
    if (d?.url) window.open(d.url, "_blank", "noopener");
  }

  const hasLink = Boolean(info?.zoomJoinUrl);
  const viaApi = Boolean(info?.zoomMeetingId);

  return (
    <div className="mt-1.5 rounded-md bg-[#2D8CFF]/[0.06] px-2.5 py-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-bold text-[#1a6fd6]">🎥 Zoom</span>
        {hasLink ? (
          <>
            <a href={info!.zoomJoinUrl!} target="_blank" rel="noreferrer" className="max-w-[220px] truncate font-semibold text-brand-600 hover:underline">
              {viaApi ? `Meeting ${info!.zoomMeetingId}` : "Pasted link"}
            </a>
            {info?.zoomPassword && <span className="text-muted">· passcode {info.zoomPassword}</span>}
            <button
              type="button"
              className="text-muted hover:text-ink"
              onClick={() => {
                navigator.clipboard?.writeText(info!.zoomJoinUrl!).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "✓ copied" : "copy"}
            </button>
          </>
        ) : (
          <span className="text-muted">{configured ? "No meeting yet" : "Zoom not connected — paste a link, or connect Zoom in Portal Settings"}</span>
        )}
        <span className="ml-auto flex flex-wrap gap-1">
          {viaApi && configured && (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={start} title="Start the meeting as host">
                {busy === "start" ? "…" : "▶ Start"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={async () => (await act("sync")) && onChange()} title="Push the class's current schedule to Zoom">
                {busy === "sync" ? "…" : "↻ Sync"}
              </button>
            </>
          )}
          {!hasLink && configured && (
            <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={async () => (await act("create")) && onChange()}>
              {busy === "create" ? "Creating…" : "+ Create meeting"}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPaste((v) => !v)}>
            {hasLink ? "Replace" : "Paste link"}
          </button>
          {hasLink && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={Boolean(busy)}
              onClick={async () => confirm(viaApi ? "Delete this Zoom meeting and remove the link?" : "Remove this link?") && (await act("remove")) && onChange()}
            >
              Remove
            </button>
          )}
        </span>
      </div>
      {info?.zoomError && <div className="mt-1 font-semibold text-danger">⚠️ {info.zoomError}</div>}
      {paste && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <input className="field min-w-[240px] flex-1 py-1 text-[12px]" placeholder="https://us06web.zoom.us/j/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="field w-28 py-1 text-[12px]" placeholder="Passcode" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!url.trim() || Boolean(busy)}
            onClick={async () => {
              if (viaApi && !confirm("This replaces the meeting created through Zoom (the Zoom meeting itself isn't deleted). Continue?")) return;
              if (await act("manual", { url, password: pw })) {
                setPaste(false);
                setUrl("");
                setPw("");
                onChange();
              }
            }}
          >
            Save link
          </button>
        </div>
      )}
    </div>
  );
}
