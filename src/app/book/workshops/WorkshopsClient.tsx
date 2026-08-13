"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { type EventItem } from "@/lib/data";

const MODE_FILTERS = ["All", "💻 Online", "🏃 In-Person"];
const TYPE_FILTERS = ["All", "🎭 Workshop", "⭐ Event"];

export function WorkshopsClient({
  upcoming,
  past,
  source,
}: {
  upcoming: EventItem[];
  past: EventItem[];
  source: "database" | "mock";
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        links={[
          { label: "My Portal", href: "/portal" },
          { label: "Sign Out", href: "/login" },
        ]}
      />
      <main className="mx-auto w-full max-w-6xl px-6 py-8 anim-fade">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold text-ink">Workshops &amp; Events</h1>
          {source === "database" ? (
            <span className="badge badge-ok" title="Reading from PostgreSQL">
              ● Live database
            </span>
          ) : (
            <span className="badge badge-warn" title="No DATABASE_URL configured — sample data">
              ● Sample data
            </span>
          )}
        </div>
        <p className="mb-5 text-[13px] text-slate">
          Browse upcoming sessions — limited seats. Your class conflict slots are blocked
          automatically.
        </p>

        <FilterBar />

        <div className="mb-3 flex items-center gap-2 text-[15px] font-bold text-ink">
          Upcoming{" "}
          <span className={`badge ${upcoming.length ? "badge-ok" : "badge-gray"}`}>
            {upcoming.length} available
          </span>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming workshops or events"
            sub="New sessions published by an admin will appear here."
          />
        ) : (
          <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <hr className="mt-10 border-line" />
            <div className="mb-1 mt-6 text-[15px] font-bold text-slate">
              Past Workshops &amp; Events
            </div>
            <p className="mb-4 text-[13px] text-muted">
              Browse what we&apos;ve done — photos and recordings where available.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {past.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border-[1.5px] border-dashed border-line bg-white py-16 text-center shadow-card">
      <div className="text-4xl">🎭</div>
      <div className="mt-2 font-bold text-ink">{title}</div>
      <div className="mt-1 text-[13px] text-muted">{sub}</div>
    </div>
  );
}

function FilterBar() {
  const [locOpts, setLocOpts] = useState<string[]>(["All"]);
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) =>
        setLocOpts(["All", ...(j.data ?? []).map((l: { label: string; flag: string | null }) => `${l.flag ?? ""} ${l.label}`)])
      );
  }, []);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-4 py-3.5 shadow-card">
      <FilterGroup label="Location:" options={locOpts} />
      <Sep />
      <FilterGroup label="Mode:" options={MODE_FILTERS} />
      <Sep />
      <FilterGroup label="Type:" options={TYPE_FILTERS} />
    </div>
  );
}

function FilterGroup({ label, options }: { label: string; options: string[] }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      {options.map((o, i) => (
        <button
          key={o}
          onClick={() => setActive(i)}
          className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors ${
            active === i
              ? "border-ink bg-ink text-white"
              : "border-line bg-white text-slate hover:border-brand-400 hover:text-brand-600"
          }`}
        >
          {o}
        </button>
      ))}
    </>
  );
}

function Sep() {
  return <div className="mx-1 h-6 w-px bg-line" />;
}

function EventCard({ e }: { e: EventItem }) {
  const full = e.seatsLeft === 0 && !e.past;
  const accent = e.kind === "workshop" ? "text-warn" : "text-grape";
  const badgeTone = e.kind === "workshop" ? "bg-warn" : "bg-grape";

  return (
    <div
      className={`group overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-card transition-all hover:-translate-y-1 hover:border-brand-400 hover:shadow-glow ${
        e.past ? "opacity-80" : ""
      } ${full ? "opacity-70" : ""}`}
    >
      <div
        className="relative flex h-36 items-center justify-center text-4xl"
        style={{ background: e.gradient }}
      >
        <span className="transition-transform group-hover:scale-110">{e.emoji}</span>
        {e.media && (
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            {e.media}
          </span>
        )}
        <span
          className={`absolute left-2 top-2 rounded-xl px-2 py-0.5 text-[10px] font-bold text-white ${
            e.past ? "bg-slate" : badgeTone
          }`}
        >
          {e.kind === "workshop" ? "🎭 WORKSHOP" : "⭐ EVENT"}
          {e.past && " · PAST"}
        </span>
        {full && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-extrabold tracking-wide text-white">
            FULLY BOOKED
          </div>
        )}
      </div>

      <div className="p-4">
        <div className={`mb-1 text-[11px] font-bold ${e.past ? "text-muted" : accent}`}>
          📅 {e.date}
        </div>
        <div className="mb-1.5 text-[15px] font-extrabold text-ink">{e.title}</div>
        <p className="mb-2 text-[13px] leading-relaxed text-muted">{e.desc}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={`badge ${e.mode === "online" ? "badge-info" : "badge-ok"}`}>
            {e.mode === "online" ? "💻 Online" : "🏃 In-Person"}
          </span>
          <span className="text-xs text-muted">📍 {e.location}</span>
          {!e.past && e.coach && <span className="text-xs text-muted">{e.coach}</span>}
        </div>

        {e.past ? (
          <div className="flex items-center justify-between">
            <span className="badge badge-gray">Completed · {e.attended} attended</span>
          </div>
        ) : full ? (
          <div className="flex items-center justify-between">
            <span className="badge badge-danger">0 seats left</span>
            <button className="btn btn-ghost btn-sm">+ Join Waitlist</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-muted">Seats left</div>
              <div className="font-display text-lg font-extrabold text-ink">
                {e.seatsLeft} <span className="text-[11px] text-muted">/{e.seatsTotal}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-brand-600">SEK {e.price}</div>
              <Link href="/plans" className="btn btn-primary btn-sm mt-2">
                Book Now →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
