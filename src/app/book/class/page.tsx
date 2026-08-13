"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { Stepper } from "@/components/Stepper";
import { CATEGORIES, LEVELS } from "@/lib/data";
import { saveDraft } from "@/lib/bookingDraft";

type Location = { id: string; label: string; flag: string | null };
type ClassRow = {
  id: string;
  name: string;
  category: string;
  level: string;
  location: string;
  mode: "online" | "offline";
  days: string | null;
  startTime: string;
  endTime: string;
  coach: string | null;
  price: number;
};

const fmt = (t?: string) => (t ? t.slice(0, 5) : "");

export default function BookClassPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [consent, setConsent] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [location, setLocation] = useState("");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("2025-08-04");
  const [endDate, setEndDate] = useState("2025-10-31");

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocations(j.data ?? []));
    fetch("/api/classes")
      .then((r) => r.json())
      .then((j) => setClasses(j.data ?? []));
  }, []);

  // Classes matching the chosen mode (and location, when picked for in-person).
  const available = useMemo(
    () =>
      classes.filter(
        (c) => c.mode === mode && (mode === "online" || !location || c.location === location)
      ),
    [classes, mode, location]
  );

  const selected = available.find((c) => c.id === classId) || null;

  // Reset selection when the filters change it out of range.
  useEffect(() => {
    if (classId && !available.some((c) => c.id === classId)) setClassId("");
  }, [available, classId]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Book a Dance Class</div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8 anim-fade">
        <Stepper steps={["Class Details", "Choose Plan", "Pay & Confirm"]} current={0} />

        <div className="card">
          <div className="card-title">Class Preferences</div>

          {/* Mode toggle */}
          <div className="mb-4">
            <label className="field-label">Mode of Class *</label>
            <div className="flex w-fit overflow-hidden rounded-lg border-2 border-line">
              {(["online", "offline"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-5 py-2 text-[13px] font-semibold transition-colors ${
                    mode === m ? "bg-ink text-white" : "bg-white text-slate"
                  }`}
                >
                  {m === "online" ? "💻 Online" : "🏃 In-Person"}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="field-label">Location / City *</label>
            {mode === "online" ? (
              <>
                <input
                  className="field mb-1.5"
                  placeholder="Type your city (e.g. Bangalore, Dubai…)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <div className="text-[11px] text-muted">
                  📍 Online classes are open to all cities globally.
                </div>
              </>
            ) : (
              <>
                <select
                  className="field"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="">Select studio location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.label}>
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-[11px] text-muted">
                  🏛️ In-Person classes are available at our studio locations above.
                </div>
              </>
            )}
          </div>

          {/* Class selector — auto-fills category, level, and time */}
          <div className="mb-4">
            <label className="field-label">Select a Class *</label>
            {available.length > 0 ? (
              <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Choose an available class…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.category} · {c.level}
                    {c.days ? ` · ${c.days}` : ""} · {fmt(c.startTime)}–{fmt(c.endTime)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 px-3 py-2.5 text-[12px] text-muted">
                No classes available for this selection yet. Choose a different mode/location, or
                contact the studio.
              </div>
            )}
          </div>

          {/* Auto-filled details (read-only) */}
          {selected && (
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border-[1.5px] border-brand-200 bg-brand-50 p-4 sm:grid-cols-4">
              <Auto label="Category" value={selected.category} />
              <Auto label="Level" value={selected.level} />
              <Auto
                label="Class Time"
                value={`${fmt(selected.startTime)} – ${fmt(selected.endTime)}`}
                highlight
              />
              <Auto label="Price" value={selected.price ? `SEK ${selected.price}` : "—"} />
              <Auto label="Coach" value={selected.coach || "TBA"} />
            </div>
          )}

          {/* Recurring period */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Start Date *</label>
              <input className="field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">End Date (recurring until) *</label>
              <input className="field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border-[1.5px] border-ok/40 bg-ok/10 px-4 py-2.5 text-xs text-[#1f6e4b]">
            ✅ Your class runs at the fixed time shown above. The admin team confirms your enrolment
            within 24 hours.
          </div>

          {/* Consent */}
          <button
            onClick={() => setConsent((c) => !c)}
            className="mt-5 flex w-full items-start gap-3 rounded-lg border-2 border-warn/50 bg-warn/10 p-4 text-left"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 text-xs font-bold text-white transition-colors ${
                consent ? "border-warn bg-warn" : "border-warn"
              }`}
            >
              {consent && "✓"}
            </span>
            <span className="text-[13px] leading-relaxed text-[#7a5512]">
              <strong>Media Consent Disclaimer</strong>
              <br />
              By registering, you agree to share pictures and videos of the session(s) you attend.{" "}
              <span className="font-bold text-danger">* Required to proceed.</span>
            </span>
          </button>

          <div className="mt-5 flex justify-between">
            <Link href="/book" className="btn btn-ghost">
              ← Back
            </Link>
            <button
              className={`btn btn-primary ${consent && selected ? "" : "is-disabled"}`}
              onClick={() => {
                if (!selected || !consent) return;
                const loc = locations.find((l) => l.label === location);
                saveDraft({
                  type: "class",
                  location: mode === "online" ? location || selected.location : location,
                  flag: loc?.flag ?? "",
                  mode,
                  period: `${startDate} – ${endDate}`,
                  detail: `${selected.name} · ${fmt(selected.startTime)}–${fmt(selected.endTime)}`,
                  category: selected.category,
                  level: selected.level,
                  classId: selected.id,
                  baseAmount: selected.price || 0,
                });
                router.push("/plans");
              }}
            >
              Choose Plan →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Auto({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-[13px] font-bold ${highlight ? "text-brand-600" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
