"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoWordmark } from "@/components/Logo";
import { Stepper } from "@/components/Stepper";
import { LocationSelect } from "@/components/LocationSelect";

export default function AddMemberPage() {
  const [consent, setConsent] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Add a Family Member</div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8 anim-fade">
        <Stepper steps={["Your Account", "Member Details", "Book & Pay"]} current={1} />

        <div className="mb-4 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a]">
          👨‍👩‍👧 You&apos;re adding a new member under your account (
          <strong>priya@example.com</strong>). Their bookings and receipts will appear separately in
          your portal under their name.
        </div>

        <div className="card">
          <div className="card-title">Member Details</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Member&apos;s Full Name *</label>
              <input className="field" placeholder="e.g. Aanya Sharma" />
            </div>
            <div>
              <label className="field-label">Date of Birth *</label>
              <input className="field" type="date" />
            </div>
            <div>
              <label className="field-label">Gender *</label>
              <select className="field">
                <option>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="field-label">Relationship to You *</label>
              <select className="field">
                <option>Child / Dependent</option>
                <option>Spouse / Partner</option>
                <option>Sibling</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="mt-3.5 rounded-lg border-[1.5px] border-line bg-cream/60 p-3.5">
            <div className="mb-2 text-[11px] font-bold text-slate">
              Shared from your account — no re-entry needed
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Contact Email</label>
                <input className="field bg-cream-deep text-muted" value="priya@example.com" readOnly />
              </div>
              <div>
                <label className="field-label">Contact Phone</label>
                <input className="field bg-cream-deep text-muted" value="+46 70 000 0000" readOnly />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="field-label">Home Studio Location *</label>
            <LocationSelect withCountry />
          </div>

          <button
            onClick={() => setConsent((c) => !c)}
            className="mt-4 flex w-full items-start gap-3 rounded-lg border-2 border-warn/50 bg-warn/10 p-4 text-left"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 text-xs font-bold text-white transition-colors ${
                consent ? "border-warn bg-warn" : "border-warn"
              }`}
            >
              {consent && "✓"}
            </span>
            <span className="text-[13px] leading-relaxed text-[#7a5512]">
              <strong>Media Consent for this Member</strong>
              <br />
              By adding this member, you confirm on their behalf that pictures and videos taken during
              their sessions may be used by Anchor Fitness.{" "}
              <span className="font-bold text-danger">* Required.</span>
            </span>
          </button>

          <div className="mt-5 flex justify-between">
            <Link href="/portal" className="btn btn-ghost">
              ← Back to Portal
            </Link>
            <Link href="/book/class" className={`btn btn-primary ${consent ? "" : "is-disabled"}`}>
              Save Member &amp; Book Class →
            </Link>
          </div>
        </div>

        {/* Members list */}
        <div className="card mt-4">
          <div className="card-title">Members on Your Account</div>
          <div className="flex flex-col gap-2">
            {[
              { i: "P", c: "#EF5B2B", n: "Priya Sharma", m: "You · Stockholm · Bollywood Dance", tag: "Primary", tone: "badge-ok" },
              { i: "A", c: "#8B5CF6", n: "Aanya Sharma", m: "Child · Stockholm · Yoga · Beginner", tag: "Member", tone: "badge-grape" },
            ].map((mem) => (
              <div
                key={mem.n}
                className="flex items-center gap-3 rounded-lg border-[1.5px] border-line bg-cream/60 p-2.5"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: mem.c }}
                >
                  {mem.i}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-ink">{mem.n}</div>
                  <div className="text-[11px] text-muted">{mem.m}</div>
                </div>
                <span className={`badge ${mem.tone}`}>{mem.tag}</span>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm self-start">+ Add Another Member</button>
          </div>
        </div>
      </main>
    </div>
  );
}
