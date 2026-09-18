"use client";

import Link from "next/link";
import { useState } from "react";
import { SessionStudentNav } from "@/components/theme/shells";
import { Stepper } from "@/components/theme/Stepper";
import { Input, Select } from "@/components/theme/Input";
import { DatePicker } from "@/components/theme/DatePicker";
import { FormField, ConsentCheckbox } from "@/components/theme/form-field";
import { Badge } from "@/components/theme/Card";
import { Avatar } from "@/components/theme/Avatar";
import { LinkButton } from "@/components/theme/LinkButton";
import { LocationSelect } from "@/components/LocationSelect";

export default function AddMemberPage() {
  const [consent, setConsent] = useState(false);
  const [dob, setDob] = useState("");

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />

      <main className="animate-enter mx-auto w-full max-w-2xl px-4 py-10">
        <Stepper steps={["Your Account", "Member Details", "Book & Pay"]} current={1} />

        <div className="mb-4 rounded-lg border-[1.5px] border-info/40 bg-info/10 px-4 py-3 text-xs text-[#245a8a] dark:text-sky-200">
          👨‍👩‍👧 You&apos;re adding a new member under your account (<strong>priya@example.com</strong>).
          Their bookings and receipts will appear separately in your portal under their name.
        </div>

        <div className="surface-card p-6 md:p-7">
          <h2 className="mb-4 font-display text-base font-bold text-copy">Member Details</h2>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <FormField label="Member's Full Name" required>
              <Input placeholder="e.g. Aanya Sharma" />
            </FormField>
            <FormField label="Date of Birth" required>
              <DatePicker
                value={dob}
                onChange={setDob}
                max={new Date().toISOString().slice(0, 10)}
                yearRange={[new Date().getFullYear() - 100, new Date().getFullYear()]}
                initialMonth={`${new Date().getFullYear() - 10}-01-01`}
                placeholder="Select date of birth"
              />
            </FormField>
            <FormField label="Gender" required>
              <Select defaultValue="">
                <option value="">Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </Select>
            </FormField>
            <FormField label="Relationship to You" required>
              <Select defaultValue="Child / Dependent">
                <option>Child / Dependent</option>
                <option>Spouse / Partner</option>
                <option>Sibling</option>
                <option>Other</option>
              </Select>
            </FormField>
          </div>

          <div className="mt-1.5 rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-3.5">
            <div className="mb-2 text-[11px] font-bold text-copy-dim">
              Shared from your account — no re-entry needed
            </div>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <FormField label="Contact Email">
                <Input value="priya@example.com" readOnly />
              </FormField>
              <FormField label="Contact Phone">
                <Input value="+46 70 000 0000" readOnly />
              </FormField>
            </div>
          </div>

          <div className="mt-3">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
              Home Studio Location <span className="text-danger">*</span>
            </span>
            <LocationSelect withCountry />
          </div>

          <div className="mt-4">
            <ConsentCheckbox checked={consent} onChange={setConsent} title="Media Consent for this Member">
              By adding this member, you confirm on their behalf that pictures and videos taken during
              their sessions may be used by Anchor Fitness.{" "}
              <span className="font-bold text-danger">* Required.</span>
            </ConsentCheckbox>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <Link
              href="/portal"
              className="text-sm font-semibold text-copy-dim transition hover:text-accent"
            >
              ← Back to Portal
            </Link>
            <LinkButton href="/book/class" className={consent ? "" : "pointer-events-none opacity-40"}>
              Save Member &amp; Book Class →
            </LinkButton>
          </div>
        </div>

        {/* Members list */}
        <div className="surface-card mt-4 p-6 md:p-7">
          <h2 className="mb-4 font-display text-base font-bold text-copy">Members on Your Account</h2>
          <div className="flex flex-col gap-2">
            {[
              {
                n: "Priya Sharma",
                m: "You · Stockholm · Bollywood Dance",
                tag: "Primary",
                tone: "success" as const,
              },
              {
                n: "Aanya Sharma",
                m: "Child · Stockholm · Yoga · Beginner",
                tag: "Member",
                tone: "purple" as const,
              },
            ].map((mem) => (
              <div
                key={mem.n}
                className="flex items-center gap-3 rounded-lg border-[1.5px] border-hairline bg-surface-muted/50 p-2.5"
              >
                <Avatar name={mem.n} size="sm" />
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-copy">{mem.n}</div>
                  <div className="text-[11px] text-copy-dim">{mem.m}</div>
                </div>
                <Badge tone={mem.tone}>{mem.tag}</Badge>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
