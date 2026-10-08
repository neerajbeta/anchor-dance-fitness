"use client";

import { useEffect, useState } from "react";

type ZoomClass = {
  id: string;
  name: string;
  days: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  coach: string | null;
  joinUrl: string | null;
  password: string | null;
};

const JS_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The next session start (local time) within the class's dates, or null. */
function nextSession(c: ZoomClass, now: Date) {
  const days = new Set((c.days ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const [eh, em] = c.endTime.split(":").map(Number);
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const day = iso(d);
    if (c.startDate && day < c.startDate) continue;
    if (c.endDate && day > c.endDate) return null;
    if (days.size ? !days.has(JS_DAY[d.getDay()]) : day !== c.startDate) continue;
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em);
    if (end <= now) continue; // today's session is already over
    const [sh, sm] = c.startTime.split(":").map(Number);
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm), end };
  }
  return null;
}

/** "Join on Zoom" for the online classes this student has booked. Hidden when there are none. */
export function ZoomClassesPanel() {
  const [list, setList] = useState<ZoomClass[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my-zoom", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setList(j.data ?? []))
      .catch(() => {});
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!list.length) return null;

  return (
    <div className="surface-card mb-5 p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">💻</span>
        <h2 className="font-display text-base font-bold text-copy">My online classes</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((c) => {
          const next = nextSession(c, now);
          const live = next && now >= new Date(next.start.getTime() - 15 * 60_000) && now < next.end;
          return (
            <div key={c.id} className="rounded-xl border border-hairline bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold text-copy">{c.name}</div>
                  <div className="text-[12px] text-copy-dim">
                    {c.days ? `${c.days} · ` : ""}
                    {c.startTime.slice(0, 5)}–{c.endTime.slice(0, 5)}
                    {c.coach ? ` · ${c.coach}` : ""}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-copy">
                    {live
                      ? "🔴 Live now — join the class"
                      : next
                      ? `Next: ${next.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${c.startTime.slice(0, 5)}`
                      : "No more sessions scheduled"}
                  </div>
                </div>
              </div>
              {c.joinUrl ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={c.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white no-underline shadow-sm transition hover:-translate-y-0.5 ${
                      live ? "bg-[#2D8CFF]" : "bg-[#2D8CFF]/85"
                    }`}
                  >
                    🎥 Join on Zoom
                  </a>
                  {c.password && (
                    <button
                      type="button"
                      className="text-[12px] text-copy-dim hover:text-accent"
                      onClick={() => {
                        navigator.clipboard?.writeText(c.password!).catch(() => {});
                        setCopied(c.id);
                        setTimeout(() => setCopied(null), 1500);
                      }}
                      title="Copy passcode"
                    >
                      Passcode <span className="font-mono font-semibold text-copy">{c.password}</span> {copied === c.id ? "✓" : "⧉"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-copy-dim">The Zoom link will appear here before your first class.</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-copy-dim">The link opens 15 minutes before class. Please keep it to yourself — it&apos;s for booked students only.</p>
    </div>
  );
}
