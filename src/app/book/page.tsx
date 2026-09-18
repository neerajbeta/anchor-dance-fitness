import Link from "next/link";
import { getUserSession } from "@/lib/auth/userActions";
import { StudentShell } from "@/components/theme/shells";
import { Badge } from "@/components/theme/Card";
import { PageHeader } from "@/components/theme/states";

export const dynamic = "force-dynamic";

const TYPES = [
  {
    href: "/book/class",
    emoji: "💃",
    title: "Dance / Zumba Class",
    desc: "Recurring classes in Yoga, Zumba or Bollywood Dance. Select age group, level, and mode.",
    tags: [
      { label: "Recurring", tone: "info" as const },
      { label: "Online / Offline", tone: "success" as const },
    ],
  },
  {
    href: "/book/workshops",
    emoji: "🎭",
    title: "Workshops & Events",
    desc: "Ad-hoc sessions and special events. Browse upcoming listings with photos, videos and availability.",
    tags: [
      { label: "Ad-hoc", tone: "warning" as const },
      { label: "Online / Offline", tone: "success" as const },
    ],
  },
  {
    href: "/book/studio",
    emoji: "🏛️",
    title: "Studio Hire",
    desc: "Book the whole studio for personal or group use. Select a date and available time slot.",
    tags: [{ label: "Hourly / Half-day", tone: "purple" as const }],
  },
];

export default async function BookHome() {
  const session = await getUserSession();

  return (
    <StudentShell userName={session?.name ?? null}>
      <PageHeader
        title="Book a Session"
        description="Choose the type of booking you'd like to make."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {TYPES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-[18px] border border-hairline bg-surface p-6 text-center shadow-[var(--shadow-sm)] transition-all hover:-translate-y-1 hover:border-accent/50 hover:shadow-[var(--shadow-md)]"
          >
            <div className="mb-3 text-4xl transition-transform group-hover:scale-110">{t.emoji}</div>
            <div className="mb-1.5 font-display text-[15px] font-bold text-copy">{t.title}</div>
            <p className="text-[13px] leading-relaxed text-copy-dim">{t.desc}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {t.tags.map((tag) => (
                <Badge key={tag.label} tone={tag.tone}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </StudentShell>
  );
}
