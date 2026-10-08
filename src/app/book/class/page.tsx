"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Footprints,
  Layers,
  MapPin,
  Monitor,
  Music2,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { SessionStudentNav } from "@/components/theme/shells";
import { Stepper } from "@/components/theme/Stepper";
import { Select } from "@/components/theme/Input";
import { DatePicker } from "@/components/theme/DatePicker";
import { Button } from "@/components/theme/Button";
import { ConsentChoices } from "@/components/ConsentChoices";
import { EMPTY_CONSENT, hasRequiredConsent } from "@/lib/consent";
import { saveDraft } from "@/lib/bookingDraft";
import { monthsBetween } from "@/lib/plans";
import { countSessions, isSeries, lastClassDate, parseDays, scheduleDates } from "@/lib/classSchedule";
import { cn } from "@/lib/cn";
import { useVatRules } from "@/lib/useVatRules";
import { VatTag } from "@/components/payments/Vat";
import { vatPriceNote, vatRuleFor } from "@/lib/vat";
import { WaitlistButton, useMyWaitlist } from "@/components/WaitlistButton";

type Location = { id: string; label: string; flag: string | null };
type ClassRow = {
  id: string;
  name: string;
  category: string;
  level: string;
  location: string;
  mode: "online" | "offline";
  days: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  coach: string | null;
  price: number;
  seats?: { capacity: number; left: number | null; full: boolean } | null;
};

const fmt = (t?: string) => (t ? t.slice(0, 5) : "");
const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function BookClassPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [location, setLocation] = useState("");
  const [classId, setClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Classes this student already holds — shown as "Already booked", not selectable.
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/my-bookings")
      .then((r) => r.json())
      .then((j) => setBookedIds(new Set(j.data?.classIds ?? [])))
      .catch(() => {});
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocations(j.data ?? []));
    fetch("/api/classes")
      .then((r) => r.json())
      .then((j) => setClasses(j.data ?? []));
  }, []);

  // Local calendar date (not UTC), so "today" matches the customer's own calendar.
  const today = toIso(new Date());

  // How many classes are hidden only because their course has already ended.
  const matching = useMemo(
    // Both modes filter by studio location; "All locations" ("") shows every class in that mode.
    () => classes.filter((c) => c.mode === mode && (!location || c.location === location)),
    [classes, mode, location],
  );
  // A class whose course has ended has no dates left to book, so it isn't offered.
  const available = useMemo(
    () =>
      matching.filter((c) => {
        const last = lastClassDate(c);
        return !last || last >= today;
      }),
    [matching, today],
  );
  const endedCount = matching.length - available.length;

  // Full classes can't be picked — unless a waitlist seat is being held for this student.
  const waitlist = useMyWaitlist();
  const waitEntry = (id: string) => waitlist.entries.find((w) => w.classId === id);
  const isFull = (c: ClassRow) => Boolean(c.seats?.full) && waitEntry(c.id)?.status !== "offered";
  const selected = available.find((c) => c.id === classId && !bookedIds.has(c.id) && !isFull(c)) || null;

  useEffect(() => {
    if (classId && !available.some((c) => c.id === classId)) setClassId("");
  }, [available, classId]);

  // For a series the customer picks their own dates. They start empty and may
  // only fall inside the class's course dates (when admin set them), never in the past.
  const oneOff = selected ? !isSeries(selected) : false;
  const minDate = selected?.startDate && selected.startDate > today ? selected.startDate : today;
  const maxDate = (selected && lastClassDate(selected)) ?? undefined;

  // Switching class: a one-off has its single fixed date; for a series, drop
  // dates that no longer fit the new class's range.
  const selectedId = selected?.id;
  useEffect(() => {
    if (selected && oneOff && selected.startDate) {
      setStartDate(selected.startDate);
      setEndDate(lastClassDate(selected) ?? selected.startDate);
      return;
    }
    setStartDate((v) => (v && v >= minDate && (!maxDate || v <= maxDate) ? v : ""));
    setEndDate((v) => (v && v >= minDate && (!maxDate || v <= maxDate) ? v : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const dateError = !startDate || !endDate
    ? null
    : startDate < minDate
    ? "Start date can't be in the past or before the class starts."
    : maxDate && endDate > maxDate
    ? `This class runs until ${maxDate} — pick an end date on or before it.`
    : endDate < startDate
    ? "End date must be on or after the start date."
    : null;
  const datesValid = Boolean(startDate && endDate) && !dateError;

  const canContinue = Boolean(hasRequiredConsent(consent) && selected && datesValid);
  // What's still missing, so the disabled button explains itself.
  const missing = !selected
    ? "Pick a class to continue"
    : !startDate || !endDate
    ? "Choose your dates"
    : dateError
    ? "Fix the dates"
    : !hasRequiredConsent(consent)
    ? "Accept the privacy & GDPR consent"
    : null;

  function goToPlans() {
    if (!selected || !canContinue) return;
    // The booking is recorded against the class's own studio.
    const classLocation = location || selected.location;
    const loc = locations.find((l) => l.label === classLocation);
    saveDraft({
      type: "class",
      location: classLocation,
      flag: loc?.flag ?? "",
      mode,
      period: `${startDate} – ${endDate}`,
      startDate,
      endDate,
      detail: `${selected.name} · ${fmt(selected.startTime)}–${fmt(selected.endTime)}`,
      category: selected.category,
      level: selected.level,
      classId: selected.id,
      baseAmount: selected.price || 0,
      consent,
    });
    router.push("/plans");
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <SessionStudentNav />

      <main className="animate-enter mx-auto w-full max-w-3xl px-4 py-8 pb-40 md:py-10 md:pb-28">
        <Stepper
          steps={["Class Details", "Choose Plan", "Pay & Confirm"]}
          icons={[CalendarDays, Layers, CreditCard]}
          current={0}
          subtitle="Choose online or in-person, pick your class and your dates — takes under a minute."
        />

        {/* 1 · Mode + location */}
        <Section icon={Sparkles} title="Class Mode & Location">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode of class">
            <ModeTile
              active={mode === "online"}
              onClick={() => setMode("online")}
              icon={Monitor}
              title="Online"
              text="Live classes from anywhere, via video call."
            />
            <ModeTile
              active={mode === "offline"}
              onClick={() => setMode("offline")}
              icon={Footprints}
              title="In-Person"
              text="Train with a coach at one of our studios."
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
              <MapPin className="h-3.5 w-3.5" /> Studio Location
            </span>
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.label}>
                  {l.flag} {l.label}
                </option>
              ))}
            </Select>
            <span className="mt-1.5 block text-[11px] text-copy-dim">
              {mode === "online"
                ? "Online classes can be joined from anywhere — pick a studio to narrow the list."
                : "In-Person classes take place at the studio shown on each class."}
            </span>
          </label>
        </Section>

        {/* 2 · Class */}
        <Section
          icon={Music2}
          title="Pick your class"
          aside={available.length > 0 ? `${available.length} available` : undefined}
        >
          {available.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Classes">
              {available.map((c) => {
                const full = !bookedIds.has(c.id) && isFull(c);
                return (
                  <div key={c.id} className="flex flex-col gap-2">
                    <ClassCard
                      c={c}
                      active={c.id === classId && !bookedIds.has(c.id) && !full}
                      booked={bookedIds.has(c.id)}
                      full={full}
                      held={waitEntry(c.id)?.status === "offered"}
                      flag={locations.find((l) => l.label === c.location)?.flag}
                      onSelect={() => setClassId(c.id)}
                    />
                    {full ? (
                      <WaitlistButton
                        type="class"
                        classId={c.id}
                        title={`${c.name} · ${fmt(c.startTime)}–${fmt(c.endTime)}`}
                        entry={waitEntry(c.id)}
                        onChange={waitlist.reload}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border-[1.5px] border-dashed border-hairline bg-surface-muted/40 px-4 py-8 text-center">
              <Music2 className="mb-2 h-7 w-7 text-copy-dim" />
              <div className="text-sm font-semibold text-copy">No classes to show</div>
              <p className="mt-1 max-w-sm text-[12px] text-copy-dim">
                {endedCount > 0
                  ? `${endedCount} class${endedCount === 1 ? " has" : "es have"} already ended here. Try another mode or location, or contact the studio.`
                  : "Nothing scheduled for this selection yet. Try another mode or location, or contact the studio."}
              </p>
            </div>
          )}
        </Section>

        {/* 3 · Dates */}
        <Section icon={CalendarDays} title={oneOff ? "Class date" : "Choose your dates"} muted={!selected}>
          {!selected ? (
            <p className="text-[13px] text-copy-dim">
              Pick a class first — its schedule decides which dates you can book.
            </p>
          ) : oneOff ? (
            // A one-off runs on a single fixed date — nothing to choose.
            <div className="flex items-center gap-3 rounded-xl bg-accent/[0.06] px-4 py-3">
              <CalendarDays className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <div className="text-sm font-bold text-copy">{scheduleDates(selected) ?? "Date to be confirmed"}</div>
                <div className="text-[12px] text-copy-dim">
                  One-off session · {fmt(selected.startTime)}–{fmt(selected.endTime)}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
                    Start Date <span className="text-danger">*</span>
                  </span>
                  <DatePicker
                    value={startDate}
                    min={minDate}
                    max={maxDate}
                    onChange={setStartDate}
                    placeholder="Select start date"
                    markWeekdays={parseDays(selected.days)}
                  />
                </label>
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
                    End Date (recurring until) <span className="text-danger">*</span>
                  </span>
                  <DatePicker
                    value={endDate}
                    min={startDate || minDate}
                    max={maxDate}
                    onChange={setEndDate}
                    placeholder="Select end date"
                    markWeekdays={parseDays(selected.days)}
                    initialMonth={startDate || undefined}
                  />
                </label>
              </div>

              {dateError ? (
                <p className="mb-2 text-[12px] font-semibold text-danger">{dateError}</p>
              ) : datesValid ? (
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-3 py-1 text-[12px] font-semibold text-ok">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {monthsBetween(startDate, endDate)}-month booking · {startDate} → {endDate}
                </p>
              ) : null}
              {selected.startDate || selected.endDate ? (
                <p className="text-[11px] text-copy-dim">
                  This class runs{selected.startDate ? ` from ${selected.startDate}` : ""}
                  {selected.endDate ? ` until ${selected.endDate}` : ""} — choose dates within that range.
                </p>
              ) : null}
            </>
          )}
        </Section>

        {/* 4 · Consent */}
        <Section icon={ShieldCheck} title="Confirm & Consent">
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-ok/10 px-4 py-3 text-xs text-[#1f6e4b] dark:text-emerald-300">
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
            Your class runs at the fixed time shown on the class. The admin team confirms your enrolment within 24
            hours.
          </div>
          <ConsentChoices value={consent} onChange={setConsent} />
        </Section>
      </main>

      {/* Sticky summary + continue (sits above the phone tab bar) */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-hairline bg-surface/90 shadow-[0_-8px_30px_rgba(20,17,16,0.06)] backdrop-blur-lg md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {selected ? (
              <>
                <div className="truncate text-sm font-bold text-copy">{selected.name}</div>
                <div className="truncate text-[12px] text-copy-dim">
                  {fmt(selected.startTime)}–{fmt(selected.endTime)} ·{" "}
                  <span className="font-semibold text-accent">SEK {(selected.price || 0).toLocaleString()}/mo</span>
                  <VatTag type="class" className="ml-1" />
                  {missing ? ` · ${missing}` : ""}
                </div>
              </>
            ) : (
              <>
                <Link href="/book" className="text-sm font-semibold text-copy-dim transition hover:text-accent">
                  ← Back
                </Link>
                <div className="text-[12px] text-copy-dim">{missing}</div>
              </>
            )}
          </div>
          <Button disabled={!canContinue} onClick={goToPlans} className="shrink-0">
            Choose Plan <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  aside,
  muted,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("surface-card mb-4 p-5 transition-opacity md:p-6", muted && "opacity-70")}>
      <header className="mb-4 flex items-center gap-3">
        <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_rgba(235,57,54,0.25)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-copy">{title}</h2>
        {aside ? (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">{aside}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function ModeTile({
  active,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-200",
        active
          ? "border-accent bg-accent/[0.06] shadow-[0_10px_26px_rgba(235,57,54,0.16)]"
          : "border-hairline bg-surface hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-md)]",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition",
          active ? "brand-gradient text-white" : "bg-surface-muted text-copy-dim group-hover:text-accent",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 pr-5">
        <span className="block text-[15px] font-bold text-copy">{title}</span>
        <span className="block text-[12px] leading-snug text-copy-dim">{text}</span>
      </span>
      {active ? <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-accent" /> : null}
    </button>
  );
}

/** "Series · 12 sessions" for a recurring class, "One-off" for a single session. */
function ScheduleBadge({ c }: { c: ClassRow }) {
  if (!isSeries(c)) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-grape/10 px-2 py-0.5 text-[11px] font-semibold text-grape">
        <Sparkles className="h-3 w-3" />
        One-off session
      </span>
    );
  }
  const sessions = c.startDate && c.endDate ? countSessions(c.startDate, c.endDate, parseDays(c.days)) : 0;
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
      <Repeat className="h-3 w-3" />
      Series{sessions > 0 ? ` · ${sessions} sessions` : ""}
    </span>
  );
}

function ClassCard({
  c,
  active,
  booked = false,
  full = false,
  held = false,
  flag,
  onSelect,
}: {
  c: ClassRow;
  active: boolean;
  booked?: boolean;
  full?: boolean;
  held?: boolean;
  flag?: string | null;
  onSelect: () => void;
}) {
  const vatNote = vatPriceNote(vatRuleFor(useVatRules(), "class"));
  const left = c.seats?.left;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-disabled={booked || full}
      disabled={booked || full}
      title={booked ? "You've already booked this class — see My Portal" : full ? "This class is full — join the waitlist" : undefined}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all duration-200",
        booked
          ? "cursor-not-allowed border-dashed border-ok/50 bg-surface opacity-75"
          : full
          ? "cursor-not-allowed border-dashed border-danger/40 bg-surface opacity-75"
          : active
            ? "border-accent bg-accent/[0.05] shadow-[0_12px_30px_rgba(235,57,54,0.18)]"
            : "border-hairline bg-surface hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-md)]",
      )}
    >
      {booked ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-ok px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          ✓ Already booked
        </span>
      ) : full ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Fully booked
        </span>
      ) : held ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-ok px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          🎟️ Seat held for you
        </span>
      ) : left != null && left <= 5 ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-warn px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Only {left} seat{left === 1 ? "" : "s"} left
        </span>
      ) : null}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold text-copy">{c.name}</div>
          <div className="truncate text-[12px] text-copy-dim">
            {c.category} · {c.level}
          </div>
          <ScheduleBadge c={c} />
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold",
            active ? "brand-gradient text-white" : "bg-accent/10 text-accent",
          )}
        >
          SEK {(c.price || 0).toLocaleString()}
          <span className="font-medium opacity-80">/mo</span>
          {vatNote ? <span className="block text-right text-[9px] font-semibold opacity-80">{vatNote}</span> : null}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-copy-dim">
        <span className="inline-flex items-center gap-1 font-semibold text-copy">
          <Clock3 className="h-3.5 w-3.5 text-accent" />
          {fmt(c.startTime)}–{fmt(c.endTime)}
        </span>
        {isSeries(c) ? (
          <span className="inline-flex items-center gap-1">
            <Repeat className="h-3.5 w-3.5" />
            {c.days}
          </span>
        ) : null}
        {scheduleDates(c) ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {scheduleDates(c)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {flag} {c.location}
        </span>
        {c.seats && c.seats.capacity > 0 && left != null ? (
          <span className={cn("inline-flex items-center gap-1", left === 0 ? "font-semibold text-danger" : "")}>
            <UserRound className="h-3.5 w-3.5" />
            {left}/{c.seats.capacity} seats left
          </span>
        ) : null}
        {/* Only shown when admin has assigned a coach to the class. */}
        {c.coach?.trim() ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {c.coach}
          </span>
        ) : null}
      </div>

      {active ? (
        <CheckCircle2 className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-surface text-accent" />
      ) : null}
    </button>
  );
}
