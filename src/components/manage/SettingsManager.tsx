"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";

const toLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function SettingsManager() {
  const { can } = usePermissions();
  const [rate, setRate] = useState("");
  const [purposes, setPurposes] = useState("");
  const [classTypes, setClassTypes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setRate(String(j.data.studioHourlyRate));
          setPurposes(j.data.studioPurposes.join("\n"));
          setClassTypes(j.data.demoClassTypes.join("\n"));
        } else if (j.error) {
          setError(j.error);
        }
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioHourlyRate: rate,
          studioPurposes: toLines(purposes),
          demoClassTypes: toLines(classTypes),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to save");
      setRate(String(j.data.studioHourlyRate));
      setPurposes(j.data.studioPurposes.join("\n"));
      setClassTypes(j.data.demoClassTypes.join("\n"));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const editable = can("settings.edit");

  if (!loaded) return <div className="card text-[13px] text-muted">Loading settings…</div>;

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="card">
        <div className="card-title">🏛️ Studio Hire</div>
        <label className="field-label" htmlFor="studio-rate">
          Hourly rate (SEK) *
        </label>
        <input
          id="studio-rate"
          type="number"
          min={0}
          step={1}
          className="field max-w-xs"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          disabled={!editable}
          required
        />
        <p className="mt-1.5 text-[11px] text-muted">
          Used on the student Studio Hire page and in Book Studio on Behalf (price = hours × rate).
        </p>

        <label className="field-label mt-4" htmlFor="studio-purposes">
          Booking purposes * <span className="font-normal normal-case text-muted">(one per line)</span>
        </label>
        <textarea
          id="studio-purposes"
          className="field"
          rows={6}
          value={purposes}
          onChange={(e) => setPurposes(e.target.value)}
          disabled={!editable}
        />
      </div>

      <div className="card">
        <div className="card-title">📅 Book a Demo</div>
        <label className="field-label" htmlFor="demo-types">
          Class types * <span className="font-normal normal-case text-muted">(one per line)</span>
        </label>
        <textarea
          id="demo-types"
          className="field"
          rows={4}
          value={classTypes}
          onChange={(e) => setClassTypes(e.target.value)}
          disabled={!editable}
        />
        <p className="mt-1.5 text-[11px] text-muted">Options in the “Type of Class” dropdown of the Book a Demo form.</p>
      </div>

      {error && <div className="text-xs font-semibold text-danger">{error}</div>}
      {saved && <div className="text-xs font-semibold text-ok">✓ Settings saved</div>}

      {editable ? (
        <div>
          <button className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>{busy ? "Saving…" : "Save Settings"}</button>
        </div>
      ) : (
        <div className="text-[12px] text-muted">You have view-only access to Portal Settings.</div>
      )}
    </form>
  );
}
