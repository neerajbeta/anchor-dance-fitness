"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StudentShell } from "@/components/theme/shells";
import { Badge } from "@/components/theme/Card";
import { LinkButton } from "@/components/theme/LinkButton";

type AnnouncementTone = "info" | "warning" | "urgent";
type Announcement = {
  id: string;
  title: string;
  message: string;
  tone: AnnouncementTone;
  postedOn?: string | null;
  until?: string | null;
};

export type PortalProfile = {
  name: string;
  email: string;
  city: string | null;
  country: string | null;
  location: string | null;
  flag: string | null;
} | null;

export type PortalBooking = {
  id: string;
  type: "class" | "workshop" | "event" | "studio";
  detail: string | null;
  category: string | null;
  level: string | null;
  location: string;
  flag: string | null;
  mode: "online" | "offline" | null;
  period: string | null;
  plan: string | null;
  paid: "paid" | "overdue" | "pending" | "onetime";
  status: string;
  statusTone: string;
  amount: number;
  discountCode: string | null;
  bookedOn: string | null;
  notes?: string | null;
};

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "purple";

// Registration.statusTone (ok/warn/danger/info/gray) → themed Badge tone.
const STATUS_TONE: Record<string, BadgeTone> = {
  ok: "success",
  warn: "warning",
  danger: "danger",
  info: "info",
  gray: "neutral",
};

const PAYMENT: Record<PortalBooking["paid"], { label: string; tone: BadgeTone }> = {
  paid: { label: "✓ Paid", tone: "success" },
  overdue: { label: "✗ Overdue", tone: "danger" },
  pending: { label: "Pending", tone: "warning" },
  onetime: { label: "Waived", tone: "neutral" },
};

function modeLabel(mode: PortalBooking["mode"]) {
  if (mode === "online") return "💻 Online";
  if (mode === "offline") return "🏃 In-Person";
  return null;
}

// Based on the visitor's own local clock: 5–12 morning, 12–17 afternoon, 17–22 evening, else night.
function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

export function PortalClient({
  userName,
  profile,
  bookings,
  announcements = [],
}: {
  userName: string | null;
  profile: PortalProfile;
  bookings: PortalBooking[];
  announcements?: Announcement[];
}) {
  // Time-of-day greeting is computed on the client to avoid a server/client mismatch.
  // Re-checked every minute so it switches over if the portal stays open.
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    const update = () => setGreeting(greetingFor(new Date().getHours()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  const classes = bookings.filter((b) => b.type === "class");
  const workshopsEvents = bookings.filter((b) => b.type === "workshop" || b.type === "event");
  const studio = bookings.filter((b) => b.type === "studio");
  const home = [profile?.flag, profile?.location || profile?.city].filter(Boolean).join(" ");

  return (
    <StudentShell userName={userName} userEmail={profile?.email}>
      {/* Hero */}
      <PortalHero userName={userName} greeting={greeting} home={home} bookings={bookings} />

      {/* Announcements */}
      <AnnouncementsPanel announcements={announcements} />

      {/* Three columns */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Section title="💃 My Classes">
          {classes.length === 0 ? (
            <Empty text="No classes booked yet." />
          ) : (
            classes.map((b) => <ClassBookingCard key={b.id} booking={b} />)
          )}
          <LinkButton href="/book/class" variant="secondary" size="sm" fullWidth>
            + Book a Class
          </LinkButton>
        </Section>

        <Section title="🎭 My Workshops & Events">
          {workshopsEvents.length === 0 ? (
            <Empty text="No workshops or events booked yet." />
          ) : (
            workshopsEvents.map((b) => {
              // Same colours as the Workshops & Events page: amber = workshop, purple = event.
              const kind = b.type === "workshop" ? KIND_STYLE.workshop : KIND_STYLE.event;
              return (
                <BookingCard
                  key={b.id}
                  accent={kind.accent}
                  border={kind.border}
                  tag={kind.tag}
                  eyebrow={b.period ? `📅 ${b.period}` : ""}
                  title={b.detail || kind.tag.label}
                  meta={b.location ? `📍 ${b.location}` : ""}
                  booking={b}
                  hidePeriod
                />
              );
            })
          )}
          <LinkButton href="/book/workshops" variant="secondary" size="sm" fullWidth>
            + Browse Events
          </LinkButton>
        </Section>

        <Section title="🏛️ Studio Bookings">
          {studio.length === 0 ? (
            <Empty text="No studio bookings yet." />
          ) : (
            // Blue, so studio hire never looks like a (purple) event.
            studio.map((b) => <StudioBookingCard key={b.id} booking={b} />)
          )}
          <LinkButton href="/book/studio" variant="secondary" size="sm" fullWidth>
            + Book Studio
          </LinkButton>
        </Section>
      </div>

      {/* Payments & receipts */}
      <PaymentsPanel bookings={bookings} />
    </StudentShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card flex flex-col gap-3 p-5 md:p-6">
      <div className="mb-1 font-display text-sm font-bold text-copy">{title}</div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[16px] border-[1.5px] border-dashed border-hairline bg-surface-muted/40 px-4 py-6 text-center text-[13px] text-copy-dim">
      {text}
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "2026-09-20 – 2026-10-20" → course start/end, or null for older free-text periods. */
function coursePeriod(period: string | null, now: Date | null) {
  const m = period?.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const start = new Date(`${m[1]}T00:00:00`);
  const end = new Date(`${m[2]}T00:00:00`);
  // Progress needs "today" from the visitor's own clock — unknown until after mount.
  if (!now) return { start: shortDate(start), end: shortDate(end), progress: 0, status: "" };
  const today = new Date(now.toDateString());
  const total = Math.max(1, (end.getTime() - start.getTime()) / DAY_MS);
  const done = (today.getTime() - start.getTime()) / DAY_MS;
  const progress = Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  const status =
    today < start
      ? `Starts in ${Math.ceil((start.getTime() - today.getTime()) / DAY_MS)} days`
      : today > end
      ? "Course completed"
      : `${Math.ceil((end.getTime() - today.getTime()) / DAY_MS)} days left`;
  return { start: shortDate(start), end: shortDate(end), progress, status };
}

const PAY_BADGE: Record<PortalBooking["paid"], { label: string; tone: BadgeTone } | null> = {
  paid: { label: "✓ Paid", tone: "success" },
  pending: { label: "⏳ Payment pending", tone: "warning" },
  overdue: { label: "Payment overdue", tone: "danger" },
  onetime: null,
};

/** A class booking: style + plan header, time, studio and course progress. */
function ClassBookingCard({ booking: b }: { booking: PortalBooking }) {
  // Class detail is stored as "<class name> · <HH:MM–HH:MM>".
  const [name, time] = (b.detail ?? "").split(" · ");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const course = coursePeriod(b.period, now);
  const pay = PAY_BADGE[b.paid];

  return (
    <div className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      {/* Header: dance style, level and plan */}
      <div className="brand-gradient flex items-center justify-between gap-2 px-4 py-2.5 text-white">
        <div className="min-w-0 truncate text-[12px] font-bold">
          💃 {[b.category, b.level].filter(Boolean).join(" · ") || "Class"}
        </div>
        {b.plan ? (
          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">
            {b.plan}
          </span>
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-[15px] font-bold leading-snug text-copy">{name || "Class booking"}</div>
          {time ? (
            <span className="shrink-0 rounded-lg bg-accent/10 px-2 py-1 text-[12px] font-bold text-accent">🕒 {time}</span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-copy-dim">
          <span>
            📍 {b.flag ? `${b.flag} ` : ""}
            {b.location}
          </span>
          {modeLabel(b.mode) ? <Badge tone="info">{modeLabel(b.mode)}</Badge> : null}
        </div>

        {course ? (
          <div className="mt-3 rounded-xl bg-surface-muted/50 p-3">
            <div className="flex items-center justify-between text-[11px] text-copy-dim">
              <span>📅 {course.start}</span>
              <span>{course.end}</span>
            </div>
            <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
              <div className="brand-gradient h-full rounded-full" style={{ width: `${Math.max(course.progress, 3)}%` }} />
            </div>
            {course.status ? <div className="text-[11px] font-semibold text-copy">{course.status}</div> : null}
          </div>
        ) : b.period ? (
          <div className="mt-3 text-[12px] text-copy-dim">📅 {b.period}</div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={STATUS_TONE[b.statusTone] ?? "neutral"}>{b.status}</Badge>
          {pay ? <Badge tone={pay.tone}>{pay.label}</Badge> : null}
        </div>
      </div>
    </div>
  );
}

const GREETING_EMOJI: Record<string, string> = {
  "Good morning": "☀️",
  "Good afternoon": "🌤️",
  "Good evening": "🌆",
  "Good night": "🌙",
};

/** Welcome banner: greeting, today's date, quick stats, the latest class and shortcuts. */
function PortalHero({
  userName,
  greeting,
  home,
  bookings,
}: {
  userName: string | null;
  greeting: string;
  home: string;
  bookings: PortalBooking[];
}) {
  const firstName = userName ? userName.split(" ")[0] : "there";
  const initials =
    (userName ?? "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "👋";

  // Today's date from the visitor's own clock (after mount, like the greeting).
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  const live = bookings.filter((b) => b.status !== "Payment Cancelled");
  const count = (types: PortalBooking["type"][]) => live.filter((b) => types.includes(b.type)).length;
  const due = live.filter((b) => b.paid === "pending" || b.paid === "overdue");
  const overdue = live.filter((b) => b.paid === "overdue");
  const latestClass = live.find((b) => b.type === "class");
  const [className, classTime] = (latestClass?.detail ?? "").split(" · ");

  return (
    <div className="ink-panel portal-hero noise-overlay relative mb-5 overflow-hidden rounded-[24px] text-white shadow-[var(--shadow-lg)]">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl dark:bg-accent/40" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-accent-warm/20 blur-3xl dark:bg-accent-warm/30" />
      <div className="pointer-events-none absolute right-6 top-4 select-none text-[120px] leading-none opacity-[0.06]">⚓</div>

      <div className="relative z-10 grid gap-6 p-6 md:p-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: greeting + stats */}
        <div>
          <div className="flex items-center gap-4">
            <div className="brand-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-[var(--shadow-glow-accent)] ring-4 ring-white/10">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
                {today || " "}
              </div>
              <h1 className="font-oswald text-[28px] font-extrabold italic leading-tight md:text-[34px]">
                {greeting}, {firstName}! {GREETING_EMOJI[greeting] ?? "👋"}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-white/65 dark:text-white/75">
            {live.length > 0
              ? "Here's everything you've booked — classes, workshops and studio time."
              : "You haven't booked anything yet — start with a class, workshop or studio session."}
            {home ? ` · 📍 ${home}` : ""}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            <HeroStat icon="💃" value={count(["class"])} label="Classes" />
            <HeroStat icon="🎭" value={count(["workshop"])} label="Workshops" />
            <HeroStat icon="⭐" value={count(["event"])} label="Events" />
            <HeroStat icon="🏛️" value={count(["studio"])} label="Studio" />
            <HeroStat
              icon={overdue.length ? "⚠️" : due.length ? "⏳" : "✅"}
              value={due.length}
              label={overdue.length ? "Overdue" : "Payments due"}
              alert={overdue.length > 0}
            />
          </div>
        </div>

        {/* Right: up next + shortcuts */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur dark:border-white/15 dark:bg-white/[0.08]">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50 dark:text-white/60">Up next</div>
            {latestClass ? (
              <>
                <div className="text-[16px] font-bold leading-snug">{className || "Your class"}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  {classTime ? <HeroChip>🕒 {classTime}</HeroChip> : null}
                  {modeLabel(latestClass.mode) ? <HeroChip>{modeLabel(latestClass.mode)}</HeroChip> : null}
                  <HeroChip>📍 {latestClass.location}</HeroChip>
                  {latestClass.plan ? <HeroChip>{latestClass.plan}</HeroChip> : null}
                </div>
                <div className="mt-2 text-[12px] text-white/60 dark:text-white/70">Status: {latestClass.status}</div>
              </>
            ) : (
              <div className="text-[13px] text-white/70">
                No class booked yet. Pick one and start dancing! 💃
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <HeroAction href="/book/class" icon="💃" label="Class" />
            <HeroAction href="/book/workshops" icon="🎭" label="Workshop" />
            <HeroAction href="/book/studio" icon="🏛️" label="Studio" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon, value, label, alert }: { icon: string; value: number; label: string; alert?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 backdrop-blur ${
        alert ? "border-danger/50 bg-danger/25 dark:border-danger/60 dark:bg-danger/30" : "border-white/15 bg-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:border-white/[0.14] dark:bg-white/[0.09]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="font-oswald text-2xl font-bold leading-none">{value}</span>
      </div>
      <div className="mt-1 text-[11px] text-white/70">{label}</div>
    </div>
  );
}

function HeroChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/85 dark:bg-white/[0.14] dark:text-white">{children}</span>;
}

function HeroAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/[0.11] py-2.5 text-center transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/20 dark:border-white/[0.14] dark:bg-white/[0.09]"
    >
      <span className="text-lg transition group-hover:scale-110">{icon}</span>
      <span className="text-[11px] font-semibold text-white/85">+ {label}</span>
    </Link>
  );
}

const TONE_LOOK: Record<
  AnnouncementTone,
  { label: string; icon: string; card: string; iconBox: string; pill: string; title: string }
> = {
  urgent: {
    label: "Urgent",
    icon: "🚨",
    card: "border-danger/40 border-l-danger bg-danger/[0.06]",
    iconBox: "bg-danger text-white",
    pill: "bg-danger text-white",
    title: "text-danger",
  },
  warning: {
    label: "Heads up",
    icon: "⚠️",
    card: "border-warn/40 border-l-warn bg-warn/[0.08]",
    iconBox: "bg-warn/20",
    pill: "bg-warn/20 text-[#7a5512] dark:text-amber-300",
    title: "text-[#7a5512] dark:text-amber-300",
  },
  info: {
    label: "Update",
    icon: "📣",
    card: "border-info/30 border-l-info bg-info/[0.06]",
    iconBox: "bg-info/15",
    pill: "bg-info/15 text-info",
    title: "text-copy",
  },
};
const TONE_ORDER: AnnouncementTone[] = ["urgent", "warning", "info"];
const DISMISSED_KEY = "af_dismissed_announcements";

/**
 * Studio announcements, most urgent first. A student can hide one they've read;
 * that's remembered in this browser only (a new announcement always shows).
 */
function AnnouncementsPanel({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
    } catch {
      /* storage unavailable — show everything */
    }
  }, []);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* not remembered — fine */
    }
  };

  const sorted = [...announcements].sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone));
  const visible = sorted.filter((a) => !dismissed.includes(a.id));
  const hiddenCount = sorted.length - visible.length;
  // Long lists stay compact: the most important three, then "Show all".
  const shown = showAll ? visible : visible.slice(0, 3);

  if (announcements.length === 0 || (visible.length === 0 && hiddenCount === 0)) return null;

  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-copy">
          📣 Announcements
          {visible.length > 0 ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{visible.length}</span>
          ) : null}
        </div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              setDismissed([]);
              try {
                localStorage.removeItem(DISMISSED_KEY);
              } catch {
                /* ignore */
              }
            }}
            className="text-[12px] font-semibold text-copy-dim hover:text-accent"
          >
            Show {hiddenCount} hidden
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-hairline px-4 py-3 text-[13px] text-copy-dim">
          You&apos;re all caught up. ✨
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((a) => {
            const t = TONE_LOOK[a.tone];
            return (
              <div
                key={a.id}
                className={`animate-enter relative flex gap-3.5 rounded-[16px] border border-l-[5px] p-4 pr-10 shadow-[var(--shadow-sm)] ${t.card}`}
              >
                <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${t.iconBox}`}>
                  {t.icon}
                  {a.tone === "urgent" ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full bg-danger" aria-hidden />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${t.pill}`}>
                      {t.label}
                    </span>
                    {a.postedOn ? <span className="text-[11px] text-copy-dim">Posted {a.postedOn}</span> : null}
                    {a.until ? <span className="text-[11px] text-copy-dim">· Until {a.until}</span> : null}
                  </div>
                  <div className={`text-[14px] font-bold ${t.title}`}>{a.title}</div>
                  <div className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-copy/80">{a.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(a.id)}
                  aria-label={`Hide "${a.title}"`}
                  title="Hide"
                  className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-copy-dim transition hover:bg-black/5 hover:text-copy dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {visible.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="self-start text-[12px] font-semibold text-accent hover:underline"
            >
              {showAll ? "Show less" : `Show ${visible.length - 3} more`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Icon + colour per booking type — the same colours as the booking sections above.
const TYPE_STYLE: Record<PortalBooking["type"], { icon: string; label: string; chip: string }> = {
  class: { icon: "💃", label: "Class", chip: "bg-accent/10 text-accent" },
  workshop: { icon: "🎭", label: "Workshop", chip: "bg-warn/15 text-warn" },
  event: { icon: "⭐", label: "Event", chip: "bg-grape/15 text-grape" },
  studio: { icon: "🏛️", label: "Studio Hire", chip: "bg-info/15 text-info" },
};

type PayFilter = "all" | "paid" | "pending";

/** Payments & Receipts: totals, filter tabs and one receipt row per booking. */
function PaymentsPanel({ bookings }: { bookings: PortalBooking[] }) {
  const [filter, setFilter] = useState<PayFilter>("all");
  const cancelled = (b: PortalBooking) => b.status === "Payment Cancelled";
  const live = bookings.filter((b) => !cancelled(b));
  const paidTotal = live.filter((b) => b.paid === "paid").reduce((sum, b) => sum + b.amount, 0);
  const dueTotal = live.filter((b) => b.paid === "pending" || b.paid === "overdue").reduce((sum, b) => sum + b.amount, 0);
  const dueCount = live.filter((b) => b.paid === "pending" || b.paid === "overdue").length;

  const shown = bookings.filter((b) =>
    filter === "all" ? true : filter === "paid" ? b.paid === "paid" : !cancelled(b) && (b.paid === "pending" || b.paid === "overdue"),
  );

  return (
    <div className="surface-card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="font-display text-sm font-bold text-copy">📄 Payments &amp; Receipts</div>
        {bookings.length > 0 ? (
          <div className="inline-flex rounded-full border border-hairline bg-surface-muted/40 p-0.5 text-[12px] font-semibold">
            {(["all", "paid", "pending"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-3 py-1 transition ${
                  filter === f ? "bg-chrome text-white" : "text-copy-dim hover:text-copy"
                }`}
              >
                {f === "all" ? "All" : f === "paid" ? "Paid" : "Due"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {bookings.length === 0 ? (
        <Empty text="Your payment receipts will appear here after your first booking." />
      ) : (
        <>
          {/* Totals */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryTile icon="✅" label="Total paid" value={`SEK ${paidTotal.toLocaleString()}`} tone="text-ok" />
            <SummaryTile
              icon="⏳"
              label="Amount due"
              value={`SEK ${dueTotal.toLocaleString()}`}
              tone={dueTotal > 0 ? "text-warn" : "text-copy"}
              sub={dueCount > 0 ? `${dueCount} booking${dueCount === 1 ? "" : "s"}` : "Nothing due"}
            />
            <SummaryTile icon="🧾" label="Receipts" value={String(live.length)} tone="text-copy" sub="bookings" />
          </div>

          {shown.length === 0 ? (
            <Empty text={filter === "paid" ? "No paid bookings yet." : "Nothing due — you're all settled. 🎉"} />
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((b) => (
                <ReceiptRow key={b.id} b={b} cancelled={cancelled(b)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, tone, sub }: { icon: string; label: string; value: string; tone: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-muted/40 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-copy-dim">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 font-display text-lg font-extrabold ${tone}`}>{value}</div>
      {sub ? <div className="text-[11px] text-copy-dim">{sub}</div> : null}
    </div>
  );
}

function ReceiptRow({ b, cancelled }: { b: PortalBooking; cancelled: boolean }) {
  const type = TYPE_STYLE[b.type];
  const pay = cancelled ? { label: "Cancelled", tone: "neutral" as BadgeTone } : PAYMENT[b.paid];
  // First part of the stored detail is the name ("Test Classes · 11:00–13:00" → "Test Classes");
  // for studio it's the date, so show the purpose instead.
  const parts = (b.detail ?? "").split(" · ");
  const title = b.type === "studio" ? parts.slice(2).join(" · ") || "Studio booking" : parts[0] || b.plan || "Booking";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3.5 transition hover:border-accent/30 hover:shadow-[var(--shadow-sm)] ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${type.chip}`}>{type.icon}</div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-copy">{title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-copy-dim">
          <span className={`rounded px-1.5 py-px font-semibold ${type.chip}`}>{type.label}</span>
          {b.plan && b.type === "class" ? <span>{b.plan}</span> : null}
          {b.bookedOn ? <span>📅 {b.bookedOn}</span> : null}
          <span className="font-mono">#{b.id}</span>
          {b.discountCode ? <span className="font-semibold text-ok">🏷️ {b.discountCode}</span> : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={`text-[14px] font-extrabold text-copy ${cancelled ? "line-through" : ""}`}>
          SEK {b.amount.toLocaleString()}
        </div>
        <div className="mt-1">
          <Badge tone={pay.tone}>{pay.label}</Badge>
        </div>
      </div>
    </div>
  );
}

/** Studio detail is stored as "<date label> · <HH:MM–HH:MM> · <purpose>". */
function studioSlot(detail: string | null, period: string | null) {
  const [dateLabel, time, ...purpose] = (detail ?? "").split(" · ");
  const label = (dateLabel || period || "").trim();
  // Parse "Fri, 18 Sept 2026" / "2026-09-18" for the calendar tile and countdown.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(label) ? label : null;
  const parsed = iso ? new Date(`${iso}T00:00:00`) : new Date(label.replace(/^\w+,\s*/, "").replace("Sept", "Sep"));
  const date = Number.isNaN(parsed.getTime()) ? null : parsed;
  const times = time?.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
  let hours: number | null = null;
  if (times) {
    let mins = Number(times[3]) * 60 + Number(times[4]) - (Number(times[1]) * 60 + Number(times[2]));
    if (mins <= 0) mins += 24 * 60;
    hours = mins / 60;
  }
  return { label, date, time: time ?? null, purpose: purpose.join(" · "), hours };
}

/** A studio hire booking: calendar tile, time, purpose, notes and a countdown. */
function StudioBookingCard({ booking: b }: { booking: PortalBooking }) {
  const slot = studioSlot(b.detail, b.period);
  const pay = PAY_BADGE[b.paid];
  const cancelled = b.status === "Payment Cancelled";

  // Countdown uses the visitor's own clock, so it's worked out after mount.
  const [when, setWhen] = useState<string | null>(null);
  useEffect(() => {
    if (!slot.date) return;
    const today = new Date(new Date().toDateString());
    const days = Math.round((slot.date.getTime() - today.getTime()) / DAY_MS);
    setWhen(days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 ? `In ${days} days` : "Completed");
  }, [slot.date?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${
        cancelled ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-info to-[#5b9bd5] px-4 py-2.5 text-white">
        <div className="text-[12px] font-bold">🏛️ Studio Hire</div>
        {when ? (
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">{when}</span>
        ) : null}
      </div>

      <div className="flex gap-3.5 p-4">
        {/* Calendar tile */}
        {slot.date ? (
          <div className="flex h-[62px] w-[56px] shrink-0 flex-col overflow-hidden rounded-xl border border-info/30 text-center">
            <div className="bg-info py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {slot.date.toLocaleDateString("en-GB", { month: "short" })}
            </div>
            <div className="flex flex-1 flex-col justify-center leading-none">
              <div className="text-xl font-extrabold text-copy">{slot.date.getDate()}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-copy-dim">
                {slot.date.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-snug text-copy">{slot.purpose || "Studio booking"}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-copy-dim">
            {slot.time ? (
              <span className="rounded-lg bg-info/10 px-2 py-0.5 font-bold text-info">
                🕒 {slot.time}
                {slot.hours ? ` · ${slot.hours % 1 ? slot.hours.toFixed(1) : slot.hours}h` : ""}
              </span>
            ) : null}
            <span>
              📍 {b.flag ? `${b.flag} ` : ""}
              {b.location}
            </span>
          </div>
          {!slot.date && slot.label ? <div className="mt-1 text-[12px] text-copy-dim">📅 {slot.label}</div> : null}
        </div>
      </div>

      {b.notes ? (
        <div className="mx-4 mb-3 whitespace-pre-line rounded-lg bg-surface-muted/50 px-3 py-2 text-[12px] text-copy">
          <span className="font-semibold text-copy-dim">📝 </span>
          {b.notes}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3">
        <Badge tone={STATUS_TONE[b.statusTone] ?? "neutral"}>{b.status}</Badge>
        {pay && !cancelled ? <Badge tone={pay.tone}>{pay.label}</Badge> : null}
        {b.amount > 0 ? <span className="ml-auto text-[13px] font-bold text-copy">SEK {b.amount.toLocaleString()}</span> : null}
      </div>
    </div>
  );
}

type KindTag = { icon: string; label: string; className: string };

const KIND_STYLE: Record<"workshop" | "event", { accent: string; border: string; tag: KindTag }> = {
  workshop: {
    accent: "text-warn",
    border: "border-warn/40 border-l-[5px] border-l-warn bg-warn/[0.07]",
    tag: { icon: "🎭", label: "Workshop", className: "bg-warn text-white" },
  },
  event: {
    accent: "text-grape",
    border: "border-grape/40 border-l-[5px] border-l-grape bg-grape/[0.07]",
    tag: { icon: "⭐", label: "Event", className: "bg-grape text-white" },
  },
};

function BookingCard({
  accent,
  border,
  tag,
  eyebrow,
  title,
  meta,
  booking,
  hidePeriod,
}: {
  accent: string;
  border: string;
  /** Coloured label at the top, e.g. 🎭 WORKSHOP / ⭐ EVENT. */
  tag?: KindTag;
  eyebrow: string;
  title: string;
  meta: string;
  booking: PortalBooking;
  hidePeriod?: boolean;
}) {
  const mode = modeLabel(booking.mode);
  return (
    <div className={`rounded-[16px] border-[1.5px] p-4 ${border}`}>
      {tag && (
        <span
          className={`mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${tag.className}`}
        >
          {tag.icon} {tag.label}
        </span>
      )}
      {eyebrow && <div className={`mb-1 text-xs font-bold ${accent}`}>{eyebrow}</div>}
      <div className="mb-1 text-sm font-bold text-copy">{title}</div>
      {meta && <div className="text-[13px] text-copy-dim">{meta}</div>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone={STATUS_TONE[booking.statusTone] ?? "neutral"}>{booking.status}</Badge>
        {mode && <Badge tone="info">{mode}</Badge>}
        {booking.paid === "overdue" && <Badge tone="danger">Payment overdue</Badge>}
      </div>
      {!hidePeriod && booking.period && <div className="mt-1.5 text-[11px] text-copy-dim">{booking.period}</div>}
    </div>
  );
}
