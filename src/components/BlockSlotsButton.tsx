"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";

export function BlockSlotsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") || "");
    const endDate = String(fd.get("endDate") || date);
    if (endDate < date) {
      setError("End date must be on or after start date");
      setBusy(false);
      return;
    }
    const payload = {
      location: fd.get("location"),
      date,
      endDate,
      startTime: fd.get("startTime"),
      endTime: fd.get("endTime"),
      reason: fd.get("reason"),
    };
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block slot");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-grape" onClick={() => setOpen(true)}>
        + Block Slots
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
          >
            <div className="mb-1 font-display text-lg font-bold text-ink">Block Studio Time</div>
            <p className="mb-4 text-[13px] text-slate">
              Mark studio hours as unavailable (maintenance, private event, holiday). Blocked time
              can&apos;t be booked by users.
            </p>

            <div className="mb-3">
              <label className="field-label">Location *</label>
              <LocationSelect name="location" required />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Start Date *</label>
                <input name="date" className="field" type="date" required />
              </div>
              <div>
                <label className="field-label">End Date *</label>
                <input name="endDate" className="field" type="date" required />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Start Time *</label>
                <input name="startTime" className="field" type="time" required />
              </div>
              <div>
                <label className="field-label">End Time *</label>
                <input name="endTime" className="field" type="time" required />
              </div>
            </div>

            <div className="mb-1">
              <label className="field-label">Reason</label>
              <input name="reason" className="field" placeholder="e.g. Maintenance, private event" />
            </div>

            {error && (
              <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-between">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={`btn btn-grape ${busy ? "is-disabled" : ""}`}>
                {busy ? "Blocking…" : "🚫 Block Slot"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
