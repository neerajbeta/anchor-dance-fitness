"use client";

import { useState } from "react";
import { CoachShell } from "@/components/theme/shells";
import { Avatar } from "@/components/theme/Avatar";
import { Badge } from "@/components/theme/Card";
import { Button } from "@/components/theme/Button";
import { PageHeader } from "@/components/theme/states";

export default function CoachPortal() {
  return (
    <CoachShell>
      <PageHeader
        title="Coach Portal"
        description="Your batches, student rosters, attendance marking, and session video upload — lightweight view."
      />

      {/* Hero */}
      <div
        className="mb-5 flex items-center justify-between rounded-[22px] p-6 text-white shadow-[var(--shadow-md)]"
        style={{ background: "linear-gradient(135deg,#1a3a2a,#276749)" }}
      >
        <div>
          <div className="mb-1 font-oswald text-lg font-extrabold italic">Coach Leila 👋</div>
          <div className="text-[13px] text-white/70">
            Stockholm 🇸🇪 · 3 active batches · Next class: Mon, 4 Aug · 7:00 AM
          </div>
        </div>
        <div className="text-4xl opacity-50">🏋️</div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Batch 1 — expanded */}
        <div className="surface-card p-5 md:p-6" style={{ borderTop: "3px solid #EB3936" }}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-accent">Mon · Wed · Fri — 7:00 AM</div>
              <div className="text-sm font-bold text-copy">Morning Zumba – Batch A</div>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          <div className="mb-3 text-[13px] text-copy-dim">
            Bollywood Dance · Beginner · Stockholm · 20 students
          </div>
          <div className="mb-2 text-[11px] font-bold text-copy">Student Roster — Mon, 4 Aug</div>
          <div className="mb-3 flex flex-col gap-1.5">
            <RosterRow n="Priya Sharma" paid />
            <RosterRow n="Layla Hassan" paid={false} />
            <RosterRow n="Anita Johansson" paid />
            <div className="pl-1 text-[11px] text-copy-dim">+ 17 more students</div>
          </div>
          <div className="border-t border-hairline pt-3">
            <div className="mb-2 text-[11px] font-bold text-copy">📹 Upload Session Video</div>
            <p className="mb-2 text-[13px] text-copy-dim">
              Students who attended will be able to access this from their portal.
            </p>
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-hairline bg-surface-muted/50 p-3.5 text-center">
              <div className="mb-1.5 text-2xl">🎬</div>
              <div className="mb-1 text-[13px] font-bold text-copy">
                Drop video file here or click to upload
              </div>
              <div className="text-[11px] text-copy-dim">
                MP4 or MOV · Max 2GB · Linked to Mon, 4 Aug session
              </div>
            </div>
          </div>
        </div>

        {/* Batch 2 — summary */}
        <div className="surface-card p-5 md:p-6" style={{ borderTop: "3px solid #8B5CF6" }}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-grape">Mon · Wed — 6:00 PM</div>
              <div className="text-sm font-bold text-copy">Hip Hop – Batch B</div>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          <div className="mb-3 text-[13px] text-copy-dim">
            Hip Hop · Intermediate · Stockholm · 8 students
          </div>
          <div className="mb-3 flex gap-2">
            <MiniStat label="Paid" value="7" tone="text-ok" border="#2E9E6B" />
            <MiniStat label="Overdue" value="1" tone="text-danger" border="#DC4A3D" />
            <MiniStat label="Today" value="6" border="#EB3936" />
          </div>
          <Button variant="secondary" size="sm" fullWidth className="mb-2" onClick={() => {}}>
            View Roster &amp; Mark Attendance
          </Button>
          <Button variant="secondary" size="sm" fullWidth onClick={() => {}}>
            📹 Upload Session Video
          </Button>
        </div>

        {/* Batch 3 — no class */}
        <div className="surface-card p-5 opacity-75 md:p-6" style={{ borderTop: "3px solid #93887D" }}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-copy-dim">Tue · Thu — 7:00 PM</div>
              <div className="text-sm font-bold text-copy">Evening Salsa – Batch C</div>
            </div>
            <Badge tone="neutral">No Class Today</Badge>
          </div>
          <div className="mb-3 text-[13px] text-copy-dim">
            Salsa · Advanced · Stockholm · 15 students
          </div>
          <div className="rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 px-4 py-2.5 text-xs text-copy-dim">
            Next session: Thu, 7 Aug at 7:00 PM
          </div>
          <Button variant="secondary" size="sm" fullWidth className="mt-2" onClick={() => {}}>
            View Roster
          </Button>
        </div>
      </div>

      <div className="mt-5 rounded-lg border-[1.5px] border-warn/40 bg-warn/10 px-4 py-3 text-xs text-[#7a5512] dark:text-amber-300">
        🔒 <strong>Coach access is read-only</strong> for student and payment data. You can mark
        attendance and upload videos only. Contact admin for booking or payment queries.
      </div>
    </CoachShell>
  );
}

function RosterRow({ n, paid }: { n: string; paid: boolean }) {
  const [on, setOn] = useState(paid);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg p-2 ${
        paid ? "bg-surface-muted/50" : "bg-danger/5"
      }`}
    >
      <Avatar name={n} size="sm" className="!h-6 !w-6" />
      <div className="flex-1 text-[13px] font-bold text-copy">{n}</div>
      <Badge tone={paid ? "success" : "danger"}>{paid ? "✓ Paid" : "✗ Overdue"}</Badge>
      <span className="text-[11px] text-copy-dim">Attend:</span>
      <button
        onClick={() => setOn((o) => !o)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-ok" : "bg-hairline"}`}
        aria-pressed={on}
        aria-label={`Mark ${n} present`}
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
    <div
      className="flex-1 rounded-lg border border-hairline bg-surface p-2.5"
      style={{ borderLeft: `3px solid ${border}` }}
    >
      <div className="text-[11px] font-semibold uppercase text-copy-dim">{label}</div>
      <div className={`font-oswald text-xl font-extrabold text-copy ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
