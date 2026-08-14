import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { BookDemoButton } from "@/components/BookDemoButton";

const TYPES = [
  {
    href: "/book/class",
    emoji: "💃",
    title: "Dance / Zumba Class",
    desc: "Recurring classes in Yoga, Zumba or Bollywood Dance. Select age group, level, and mode.",
    tags: [
      { label: "Recurring", tone: "badge-info" },
      { label: "Online / Offline", tone: "badge-ok" },
    ],
  },
  {
    href: "/book/workshops",
    emoji: "🎭",
    title: "Workshops & Events",
    desc: "Ad-hoc sessions and special events. Browse upcoming listings with photos, videos and availability.",
    tags: [
      { label: "Ad-hoc", tone: "badge-warn" },
      { label: "Online / Offline", tone: "badge-ok" },
    ],
  },
  {
    href: "/book/studio",
    emoji: "🏛️",
    title: "Studio Hire",
    desc: "Book the whole studio for personal or group use. Select a date and available time slot.",
    tags: [{ label: "Hourly / Half-day", tone: "badge-grape" }],
  },
];

export default function BookHome() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        links={[
          { label: "🏠 Home", active: true },
          { label: "📅 Book", href: "/book" },
          { label: "My Portal", href: "/portal" },
          { label: "Sign Out", href: "/login" },
        ]}
        right={<BookDemoButton className="btn btn-primary btn-sm" />}
      />
      <main className="mx-auto w-full max-w-6xl px-6 py-8 anim-fade">
        <h1 className="font-display text-2xl font-bold text-ink">Book a Session</h1>
        <p className="mb-6 text-[13px] text-slate">
          Choose the type of booking you&apos;d like to make.
        </p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {TYPES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border-2 border-line bg-white p-6 text-center shadow-card transition-all hover:-translate-y-1 hover:border-brand-400 hover:shadow-glow"
            >
              <div className="mb-3 text-4xl transition-transform group-hover:scale-110">
                {t.emoji}
              </div>
              <div className="mb-1.5 text-[15px] font-bold text-ink">{t.title}</div>
              <p className="text-[13px] leading-relaxed text-muted">{t.desc}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {t.tags.map((tag) => (
                  <span key={tag.label} className={`badge ${tag.tone}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
