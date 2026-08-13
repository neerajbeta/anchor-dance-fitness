"use client";

import Link from "next/link";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { logoutUserAction } from "@/lib/auth/userActions";

export function PortalClient({ userName }: { userName: string | null }) {
  const [member, setMember] = useState("priya");
  const firstName = userName ? userName.split(" ")[0] : "Priya";

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        links={[
          { label: "🏠 Home", active: true },
          { label: "📅 Book Session", href: "/book" },
          { label: "📄 Receipts" },
          { label: "👤 Profile" },
        ]}
        right={
          userName ? (
            <form action={logoutUserAction}>
              <button type="submit" className="nav-btn">
                Sign Out
              </button>
            </form>
          ) : (
            <Link href="/login" className="nav-btn">
              Sign Out
            </Link>
          )
        }
      />

      <main className="mx-auto w-full max-w-6xl px-6 py-8 anim-fade">
        {/* Hero */}
        <div className="relative mb-5 overflow-hidden rounded-xl bg-ink p-6 text-white shadow-card">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle,#EF5B2B,transparent 70%)" }}
          />
          <div className="relative z-10">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-white/50">Viewing as:</span>
              {[
                { id: "priya", label: `${firstName} (Me)` },
                { id: "aanya", label: "Aanya (Child)" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMember(m.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    member === m.id
                      ? "bg-brand-500 text-white"
                      : "border-[1.5px] border-white/30 bg-white/10 text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
              <Link
                href="/add-member"
                className="rounded-full border-[1.5px] border-dashed border-white/30 bg-white/5 px-3 py-1 text-xs text-white/60"
              >
                + Add Member
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="mb-1 font-display text-xl font-extrabold">
                  Good morning, {firstName}! 👋
                </div>
                <div className="text-[13px] text-white/70">
                  Quarterly Plan · 💻 Online · Stockholm 🇸🇪 · Active until 31 Oct 2025
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="badge badge-ok">✓ Active</span>
                  <span className="text-xs text-white/60">42 days remaining</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href="/book" className="btn btn-primary btn-sm">
                    + New Booking
                  </Link>
                  <button className="btn btn-ghost btn-sm border-white/30 bg-transparent text-white">
                    Renew Plan
                  </button>
                </div>
              </div>
              <div className="text-5xl opacity-40">⚓</div>
            </div>
          </div>
        </div>

        {/* Three columns */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Classes */}
          <div className="card">
            <div className="card-title">💃 My Classes</div>
            <div className="rounded-xl border-[1.5px] border-line bg-white p-4">
              <div className="mb-1 text-xs font-bold text-brand-600">
                Bollywood Dance · Beginner
              </div>
              <div className="mb-1 text-sm font-bold text-ink">Batch TBD — Admin Assigning</div>
              <div className="text-[13px] text-muted">Stockholm · Age 28 · 💻 Online</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge badge-warn">Pending Assignment</span>
                <span className="badge badge-info">💻 Online</span>
              </div>
              <div className="mt-1 text-[11px] text-muted">4 Aug – 31 Oct 2025</div>
              <div className="mt-2.5 rounded-lg border border-ok/40 bg-ok/5 p-2.5">
                <div className="mb-1 text-[11px] font-bold text-ok">🔔 Reminders active</div>
                <div className="text-[11px] text-muted">
                  2 days before · 1 day before · Morning of class
                </div>
                <button className="btn btn-ghost btn-sm mt-2 text-[11px]">
                  📅 View in Calendar
                </button>
              </div>
            </div>
          </div>

          {/* Workshops */}
          <div className="card">
            <div className="card-title">🎭 My Workshops &amp; Events</div>
            <div className="mb-2 rounded-xl border-[1.5px] border-warn/30 bg-warn/5 p-4">
              <div className="mb-0.5 text-xs font-bold text-warn">
                Sat, 10 Aug · 11 AM – 1 PM
              </div>
              <div className="mb-1 text-sm font-bold text-ink">Bollywood Fusion Masterclass</div>
              <div className="text-[13px] text-muted">Stockholm · Coach Leila</div>
              <div className="mt-2 flex gap-2">
                <span className="badge badge-warn">Registered</span>
                <span className="badge badge-info">💻 Online</span>
              </div>
            </div>
            <Link href="/book/workshops" className="btn btn-ghost btn-sm btn-block">
              + Browse Events
            </Link>
          </div>

          {/* Studio */}
          <div className="card">
            <div className="card-title">🏛️ Studio Bookings</div>
            <div className="mb-2 rounded-xl border-[1.5px] border-grape/30 bg-grape/5 p-4">
              <div className="mb-0.5 text-xs font-bold text-grape">
                Thu, 7 Aug · 11:00 AM – 12:00 PM
              </div>
              <div className="mb-1 text-sm font-bold text-ink">Studio – Stockholm</div>
              <div className="text-[13px] text-muted">Personal Practice · 1 Hour</div>
              <div className="mt-2">
                <span className="badge badge-ok">Confirmed</span>
              </div>
            </div>
            <Link href="/book/studio" className="btn btn-ghost btn-sm btn-block">
              + Book Studio
            </Link>
          </div>
        </div>

        {/* Receipts */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="card-title mb-0">📄 Payment Receipts</div>
            <button className="btn btn-ghost btn-sm">View All</button>
          </div>
          <div className="flex flex-col gap-2">
            {[
              {
                id: "#AF-2025-0091 · Quarterly Class",
                meta: "4 Aug 2025 · SEK 1,047 · 💻 Online · Bollywood Dance Beginner",
              },
              {
                id: "#AF-2025-0088 · Bollywood Fusion Workshop",
                meta: "1 Aug 2025 · SEK 450 · 💻 Online",
              },
            ].map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border-[1.5px] border-line px-4 py-3"
              >
                <div>
                  <div className="text-[13px] font-bold text-ink">{r.id}</div>
                  <div className="text-[11px] text-muted">{r.meta}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-ok">Paid</span>
                  <button className="btn btn-ghost btn-sm">⬇</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
