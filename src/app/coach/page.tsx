"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { Avatar } from "@/components/ui";

export default function CoachPortal() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <div className="flex items-center gap-2">
          <LogoWordmark size={30} />
          <span className="badge rounded bg-ok text-white">COACH</span>
        </div>
        <nav className="flex items-center gap-1">
          <button className="nav-btn active">📋 My Batches</button>
          <button className="nav-btn">📤 Upload Video</button>
          <Link href="/login" className="nav-btn">
            Sign Out
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8 anim-fade">
        <h1 className="font-display text-2xl font-bold text-ink">Coach Portal</h1>
        <p className="mb-5 text-[13px] text-slate">
          Your batches, student rosters, attendance marking, and session video upload — lightweight
          view.
        </p>

        {/* Hero */}
        <div
          className="mb-5 flex items-center justify-between rounded-xl p-6 text-white shadow-card"
          style={{ background: "linear-gradient(135deg,#1a3a2a,#276749)" }}
        >
          <div>
            <div className="mb-1 font-display text-lg font-extrabold">Coach Leila 👋</div>
            <div className="text-[13px] text-white/70">
              Stockholm 🇸🇪 · 3 active batches · Next class: Mon, 4 Aug · 7:00 AM
            </div>
          </div>
          <div className="text-4xl opacity-50">🏋️</div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Batch 1 — expanded */}
          <div className="card" style={{ borderTop: "3px solid #EF5B2B" }}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-brand-600">Mon · Wed · Fri — 7:00 AM</div>
                <div className="text-sm font-bold text-ink">Morning Zumba – Batch A</div>
              </div>
              <span className="badge badge-ok">Active</span>
            </div>
            <div className="mb-3 text-[13px] text-muted">
              Bollywood Dance · Beginner · Stockholm · 20 students
            </div>
            <div className="mb-2 text-[11px] font-bold text-ink">Student Roster — Mon, 4 Aug</div>
            <div className="mb-3 flex flex-col gap-1.5">
              <RosterRow i="P" c="#EF5B2B" n="Priya Sharma" paid />
              <RosterRow i="L" c="#DC4A3D" n="Layla Hassan" paid={false} />
              <RosterRow i="A" c="#E0972B" n="Anita Johansson" paid />
              <div className="pl-1 text-[11px] text-muted">+ 17 more students</div>
            </div>
            <div className="border-t border-line pt-3">
              <div className="mb-2 text-[11px] font-bold text-ink">📹 Upload Session Video</div>
              <p className="mb-2 text-[13px] text-muted">
                Students who attended will be able to access this from their portal.
              </p>
              <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-line bg-cream/60 p-3.5 text-center">
                <div className="mb-1.5 text-2xl">🎬</div>
                <div className="mb-1 text-[13px] font-bold text-ink">
                  Drop video file here or click to upload
                </div>
                <div className="text-[11px] text-muted">
                  MP4 or MOV · Max 2GB · Linked to Mon, 4 Aug session
                </div>
              </div>
            </div>
          </div>

          {/* Batch 2 — summary */}
          <div className="card" style={{ borderTop: "3px solid #8B5CF6" }}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-grape">Mon · Wed — 6:00 PM</div>
                <div className="text-sm font-bold text-ink">Hip Hop – Batch B</div>
              </div>
              <span className="badge badge-ok">Active</span>
            </div>
            <div className="mb-3 text-[13px] text-muted">
              Hip Hop · Intermediate · Stockholm · 8 students
            </div>
            <div className="mb-3 flex gap-2">
              <MiniStat label="Paid" value="7" tone="!text-ok" border="#2E9E6B" />
              <MiniStat label="Overdue" value="1" tone="!text-danger" border="#DC4A3D" />
              <MiniStat label="Today" value="6" border="#EF5B2B" />
            </div>
            <button className="btn btn-ghost btn-sm btn-block mb-2">
              View Roster &amp; Mark Attendance
            </button>
            <button className="btn btn-ghost btn-sm btn-block">📹 Upload Session Video</button>
          </div>

          {/* Batch 3 — no class */}
          <div className="card opacity-75" style={{ borderTop: "3px solid #93887D" }}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-muted">Tue · Thu — 7:00 PM</div>
                <div className="text-sm font-bold text-ink">Evening Salsa – Batch C</div>
              </div>
              <span className="badge badge-gray">No Class Today</span>
            </div>
            <div className="mb-3 text-[13px] text-muted">
              Salsa · Advanced · Stockholm · 15 students
            </div>
            <div className="rounded-lg border-[1.5px] border-line bg-cream/60 px-4 py-2.5 text-xs text-muted">
              Next session: Thu, 7 Aug at 7:00 PM
            </div>
            <button className="btn btn-ghost btn-sm btn-block mt-2">View Roster</button>
          </div>
        </div>

        <div className="mt-5 rounded-lg border-[1.5px] border-warn/40 bg-warn/10 px-4 py-3 text-xs text-[#7a5512]">
          🔒 <strong>Coach access is read-only</strong> for student and payment data. You can mark
          attendance and upload videos only. Contact admin for booking or payment queries.
        </div>
      </main>
    </div>
  );
}

function RosterRow({ i, c, n, paid }: { i: string; c: string; n: string; paid: boolean }) {
  const [on, setOn] = useState(paid);
  return (
    <div className={`flex items-center gap-2.5 rounded-lg p-2 ${paid ? "bg-cream/60" : "bg-danger/5"}`}>
      <Avatar letter={i} color={c} size={24} />
      <div className="flex-1 text-[13px] font-bold text-ink">{n}</div>
      <span className={`badge ${paid ? "badge-ok" : "badge-danger"} text-[10px]`}>
        {paid ? "✓ Paid" : "✗ Overdue"}
      </span>
      <span className="text-[11px] text-muted">Attend:</span>
      <button
        onClick={() => setOn((o) => !o)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            on ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  border,
}: {
  label: string;
  value: string;
  tone?: string;
  border: string;
}) {
  return (
    <div className="flex-1 rounded-lg border border-line/70 bg-white p-2.5" style={{ borderLeft: `3px solid ${border}` }}>
      <div className="text-[11px] font-semibold uppercase text-muted">{label}</div>
      <div className={`font-display text-xl font-extrabold text-ink ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
