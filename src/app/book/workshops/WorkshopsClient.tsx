"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/theme/Input";
import { StudentShell } from "@/components/theme/shells";
import { Badge } from "@/components/theme/Card";
import { Button } from "@/components/theme/Button";
import { PageHeader } from "@/components/theme/states";
import { type EventItem } from "@/lib/data";
import { saveDraft } from "@/lib/bookingDraft";
import { useVatRules } from "@/lib/useVatRules";
import { vatPriceNote, vatRuleFor } from "@/lib/vat";
import { WaitlistButton, useMyWaitlist, type MyWaitlistEntry } from "@/components/WaitlistButton";
import { AskQuestionButton } from "@/components/AskQuestionButton";

type Filters = { location: string; mode: "all" | "online" | "offline"; kind: "all" | "workshop" | "event" };

const MODE_FILTERS: { value: Filters["mode"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "💻 Online" },
  { value: "offline", label: "🏃 In-Person" },
];
const TYPE_FILTERS: { value: Filters["kind"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "workshop", label: "🎭 Workshop" },
  { value: "event", label: "⭐ Event" },
];

export function WorkshopsClient({
  upcoming,
  past,
  source,
  userName,
}: {
  upcoming: EventItem[];
  past: EventItem[];
  source: "database" | "mock";
  userName?: string | null;
}) {
  const [filters, setFilters] = useState<Filters>({ location: "", mode: "all", kind: "all" });
  // Workshops/events this student already holds — shown as booked, no second booking.
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/my-bookings")
      .then((r) => r.json())
      .then((j) => setBookedIds(new Set(j.data?.eventIds ?? [])))
      .catch(() => {});
  }, []);
  const waitlist = useMyWaitlist();
  const matches = (e: EventItem) =>
    (!filters.location || e.location === filters.location) &&
    (filters.mode === "all" || e.mode === filters.mode) &&
    (filters.kind === "all" || e.kind === filters.kind);
  const shownUpcoming = useMemo(() => upcoming.filter(matches), [upcoming, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownPast = useMemo(() => past.filter(matches), [past, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = filters.location !== "" || filters.mode !== "all" || filters.kind !== "all";

  return (
    <StudentShell userName={userName}>
      <PageHeader
        title="Workshops & Events"
        description="Browse upcoming sessions — limited seats. Your class conflict slots are blocked automatically."
        action={
          source === "database" ? (
            <Badge tone="success">● Live database</Badge>
          ) : (
            <Badge tone="warning">● Sample data</Badge>
          )
        }
      />

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="mb-3 flex items-center gap-2 text-[15px] font-bold text-copy">
        Upcoming{" "}
        <Badge tone={shownUpcoming.length ? "success" : "neutral"}>{shownUpcoming.length} available</Badge>
      </div>

      {shownUpcoming.length === 0 ? (
        filtered && upcoming.length > 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            sub="Try another location, mode or type."
          />
        ) : (
          <EmptyState
            title="No upcoming workshops or events"
            sub="New sessions published by an admin will appear here."
          />
        )
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shownUpcoming.map((e) => (
            <EventCard
              key={e.id}
              e={e}
              booked={bookedIds.has(e.id)}
              waitEntry={waitlist.entries.find((w) => w.eventId === e.id)}
              onWaitlistChange={waitlist.reload}
            />
          ))}
        </div>
      )}

      {shownPast.length > 0 && (
        <>
          <hr className="mt-10 border-hairline" />
          <div className="mb-1 mt-6 text-[15px] font-bold text-copy-dim">Past Workshops &amp; Events</div>
          <p className="mb-4 text-[13px] text-copy-dim">
            Browse what we&apos;ve done — photos and recordings where available.
          </p>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shownPast.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        </>
      )}
    </StudentShell>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center rounded-[22px] border-[1.5px] border-dashed border-hairline bg-surface py-16 text-center shadow-[var(--shadow-sm)]">
      <div className="text-4xl">🎭</div>
      <div className="mt-2 font-bold text-copy">{title}</div>
      <div className="mt-1 text-[13px] text-copy-dim">{sub}</div>
    </div>
  );
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [locations, setLocations] = useState<{ label: string; flag: string | null }[]>([]);
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocations(j.data ?? []))
      .catch(() => {});
  }, []);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[16px] border border-hairline bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)]">
      {/* A dropdown rather than chips — the list grows with every studio added. */}
      <label className="flex items-center gap-2">
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-copy-dim">Location:</span>
        <Select
          className="h-9 w-auto min-w-[190px] py-1 text-[13px]"
          value={filters.location}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
        >
          <option value="">🌍 All locations</option>
          {locations.map((l) => (
            <option key={l.label} value={l.label}>
              {l.flag ?? ""} {l.label}
            </option>
          ))}
        </Select>
      </label>
      <Sep />
      <FilterGroup
        label="Mode:"
        options={MODE_FILTERS}
        value={filters.mode}
        onChange={(mode) => onChange({ ...filters, mode })}
      />
      <Sep />
      <FilterGroup
        label="Type:"
        options={TYPE_FILTERS}
        value={filters.kind}
        onChange={(kind) => onChange({ ...filters, kind })}
      />
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <>
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-copy-dim">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            value === o.value
              ? "border-chrome bg-chrome text-white"
              : "border-hairline bg-surface text-copy-dim hover:border-accent hover:text-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </>
  );
}

function Sep() {
  return <div className="mx-1 h-6 w-px bg-hairline" />;
}

function EventCard({
  e,
  booked = false,
  waitEntry,
  onWaitlistChange,
}: {
  e: EventItem;
  booked?: boolean;
  waitEntry?: MyWaitlistEntry;
  onWaitlistChange?: () => void;
}) {
  const router = useRouter();
  const full = e.seatsLeft === 0 && !e.past;
  const accent = e.kind === "workshop" ? "text-warn" : "text-grape";
  const vatNote = vatPriceNote(vatRuleFor(useVatRules(), e.kind));
  const badgeTone = e.kind === "workshop" ? "bg-warn" : "bg-grape";

  function bookNow() {
    saveDraft({
      type: e.kind,
      location: e.location,
      mode: e.mode,
      period: e.date,
      detail: e.title,
      eventId: e.id,
      baseAmount: e.price,
    });
    router.push("/plans");
  }

  return (
    <div
      id={`event-${e.id}`}
      className={`group scroll-mt-24 overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-[var(--shadow-sm)] transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow-md)] target:ring-2 target:ring-accent ${
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
        <div className={`mb-1 text-[11px] font-bold ${e.past ? "text-copy-dim" : accent}`}>
          📅 {e.date}
        </div>
        <div className="mb-1.5 text-[15px] font-extrabold text-copy">{e.title}</div>
        <p className="mb-2 text-[13px] leading-relaxed text-copy-dim">{e.desc}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={e.mode === "online" ? "info" : "success"}>
            {e.mode === "online" ? "💻 Online" : "🏃 In-Person"}
          </Badge>
          <span className="text-xs text-copy-dim">📍 {e.location}</span>
          {!e.past && e.coach && <span className="text-xs text-copy-dim">{e.coach}</span>}
          {!e.past && (
            <span className="ml-auto">
              <AskQuestionButton eventId={e.id} title={e.title} />
            </span>
          )}
        </div>

        {e.past ? (
          <Badge tone="neutral">Completed · {e.attended} attended</Badge>
        ) : booked ? (
          <div className="flex items-center justify-between gap-2">
            <Badge tone="success">✓ You&apos;re booked</Badge>
            <Button variant="secondary" size="sm" onClick={() => router.push("/portal")}>
              View in My Portal
            </Button>
          </div>
        ) : full && waitEntry?.status === "offered" ? (
          <div className="flex items-center justify-between gap-2">
            <Badge tone="success">🎟️ A seat is held for you</Badge>
            <div className="text-right">
              <div className="text-base font-extrabold text-accent">SEK {e.price}</div>
              {vatNote ? <div className="text-[10px] font-semibold text-copy-dim">{vatNote}</div> : null}
              <Button size="sm" className="mt-2" onClick={bookNow}>
                Book my seat →
              </Button>
            </div>
          </div>
        ) : full ? (
          <div className="flex items-center justify-between gap-2">
            <Badge tone="danger">0 seats left</Badge>
            <WaitlistButton type={e.kind} eventId={e.id} title={e.title} entry={waitEntry} onChange={onWaitlistChange} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-copy-dim">Seats left</div>
              <div className="font-oswald text-lg font-extrabold text-copy">
                {e.seatsLeft} <span className="text-[11px] text-copy-dim">/{e.seatsTotal}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-accent">SEK {e.price}</div>
              {vatNote ? <div className="text-[10px] font-semibold text-copy-dim">{vatNote}</div> : null}
              <Button size="sm" className="mt-2" onClick={bookNow}>
                Book Now →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
