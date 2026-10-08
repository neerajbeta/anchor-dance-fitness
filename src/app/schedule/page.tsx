import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FeeTabs } from "@/components/site/FeeTabs";
import { CONTACT, FEE_NOTES, SCHEDULE, SCHEDULE_NOTE } from "@/lib/site/content";
import { SITE } from "@/components/site/styles";
import { siteFontClass } from "@/components/site/fonts";
import { AnikaChat } from "@/components/site/AnikaChat";

export const metadata: Metadata = {
  title: "Class Schedule | Anchor Dance & Fitness — Helenelund & Tumba",
  description: "Weekly class schedule and fees — online and in-studio Bollywood, Zumba, Kathak and Yoga in Helenelund and Tumba.",
};

const STYLE_ICON: Record<string, string> = { Bollywood: "💃", Zumba: "🔥", Yoga: "🧘", Kathak: "🪷" };

export default function SchedulePage() {
  return (
    <div className={`${siteFontClass} min-h-screen bg-white text-[#1a1a1a] antialiased`} style={{ colorScheme: "light" }}>
      <SiteNav />

      <section className="relative overflow-hidden bg-[#111] py-20 text-center text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,56,53,0.28),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4">
          <div className="text-[13px] font-bold uppercase tracking-[0.25em] text-[#f89b46]">Anchor Dance &amp; Fitness</div>
          <h1 className={`${SITE.display} mt-3 text-[44px] font-extrabold leading-none sm:text-[64px]`}>
            Classes &amp; <span className="bg-gradient-to-r from-[#ea3835] to-[#f89b46] bg-clip-text text-transparent">Schedule</span>
          </h1>
          <p className="mt-4 text-[16px] text-white/70">Online &amp; In-Studio · Bollywood · Zumba · Kathak · Yoga</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {SCHEDULE.map((b) => (
              <a key={b.id} href={`#${b.id}`} className="rounded-full border border-white/25 px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-white no-underline hover:border-[#f89b46] hover:text-[#f89b46]">
                {b.title.replace(" — all locations", "")}
              </a>
            ))}
            <a href="#fee-structure" className="rounded-full border border-white/25 px-5 py-2 text-[13px] font-bold uppercase tracking-wide text-white no-underline hover:border-[#f89b46] hover:text-[#f89b46]">
              Fees
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#fbf8f4] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className={`${SITE.display} text-[34px] font-extrabold sm:text-[42px]`}>Weekly Schedule</h2>
            <p className="mt-2 text-[15px] text-[#5b5b5b]">{SCHEDULE_NOTE}</p>
          </div>

          <div className="flex flex-col gap-12">
            {SCHEDULE.map((block) => (
              <div key={block.id} id={block.id} className="scroll-mt-24">
                <div className="mb-5">
                  <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#ea3835]">{block.kicker}</div>
                  <h3 className={`${SITE.display} text-[28px] font-extrabold uppercase`}>{block.title}</h3>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {block.styles.map((s) => (
                    <div key={s.style} className="rounded-[22px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                      <div className="mb-4 flex items-center gap-2.5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ea3835] to-[#f89b46] text-lg" aria-hidden>
                          {STYLE_ICON[s.style] ?? "✨"}
                        </span>
                        <h4 className={`${SITE.display} text-[20px] font-bold uppercase`}>{s.style}</h4>
                      </div>
                      <div className="flex flex-col gap-4">
                        {s.groups.map((g) => (
                          <div key={g.audience}>
                            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-[#777]">{g.audience}</div>
                            <ul className="flex flex-col gap-1.5">
                              {g.slots.map((slot, i) => (
                                <li key={i} className="flex items-center justify-between rounded-lg bg-[#fbf8f4] px-3 py-2 text-[14px]">
                                  <span className="font-semibold text-[#1a1a1a]">{slot.day}</span>
                                  <span className={slot.day === "TBD" ? "text-[#999]" : "font-semibold text-[#c7302d]"} style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {slot.time}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fee-structure" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className={`${SITE.display} text-[34px] font-extrabold sm:text-[42px]`}>
              Fee <span className="bg-gradient-to-r from-[#ea3835] to-[#f89b46] bg-clip-text text-transparent">Structure</span>
            </h2>
            <p className="mt-2 text-[15px] text-[#5b5b5b]">{FEE_NOTES.intro}</p>
          </div>
          <FeeTabs />
          <p className="mt-4 text-center text-[13px] text-[#777]">{FEE_NOTES.footer}</p>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#ea3835] to-[#f89b46] py-16 text-center text-white">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className={`${SITE.display} text-[30px] font-extrabold uppercase sm:text-[38px]`}>Limited seats — register now</h2>
          <p className="mt-3 text-[16px] text-white/90">Secure your spot before it fills up. New batches starting soon.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="inline-flex items-center rounded-full bg-white px-7 py-3.5 text-[15px] font-bold uppercase tracking-wide text-[#ea3835] no-underline shadow-lg transition hover:-translate-y-0.5">
              Register now
            </Link>
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border-2 border-white px-7 py-3.5 text-[15px] font-bold uppercase tracking-wide text-white no-underline transition hover:bg-white/10">
              WhatsApp us
            </a>
          </div>
          <div className="mt-5 text-[14px] text-white/90">
            {CONTACT.phone} · {CONTACT.email}
          </div>
        </div>
      </section>

      <SiteFooter />
      <AnikaChat />
    </div>
  );
}
