import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { TrainersSection } from "@/components/site/TrainersSection";
import { ABOUT, asset, CLASSES, CTA, HERO, PROGRAMS, VISION } from "@/lib/site/content";
import { SITE } from "@/components/site/styles";
import { siteFontClass } from "@/components/site/fonts";
import { AnikaChat } from "@/components/site/AnikaChat";

export const metadata: Metadata = {
  title: "Anchor Dance & Fitness — Movement That Transforms",
  description:
    "Bollywood, Zumba, Yoga and Kathak classes in Helenelund, Tumba and online. Dance with us to express, connect and celebrate.",
};

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className={SITE.gradientText}>{children}</span>;
}

export default function Home() {
  return (
    // The public website is always light, whatever theme the portal uses.
    <div className={`${siteFontClass} min-h-screen bg-white text-[16px] leading-[1.6] text-[#333] antialiased`} style={{ colorScheme: "light" }}>
      <SiteNav />

      {/* Hero */}
      <section id="home" className="relative overflow-hidden pb-12 pt-10" style={{ backgroundImage: SITE.darkBg }}>
        {/* Warm red / orange glow, as on the original hero. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(234,56,53,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(248,155,70,0.1) 0%, transparent 50%)",
          }}
        />
        <div className={`${SITE.container} relative grid items-center gap-6 min-[992px]:grid-cols-2`}>
          <div className="mt-12 min-[992px]:mt-0">
            <h1 className={`${SITE.display} mb-8 text-[44px] font-extrabold leading-[1.1] sm:text-[64px]`}>
              <span className={`block ${SITE.gradientText}`}>{HERO.line1}</span>
              <span className="block text-white">{HERO.line2}</span>
            </h1>
            <p className="mb-6 text-[16px] leading-[1.6] text-white/80">{HERO.text}</p>
            <div className="mb-6">
              <Link href="/book/class" className={SITE.button}>
                Book a Class
              </Link>
            </div>
          </div>
          <HeroCarousel images={HERO.images} />
        </div>
      </section>

      {/* Classes */}
      <section id="classes" className="scroll-mt-20 bg-[#1a1a1a] py-24 text-white">
        <div className={SITE.container}>
          <h2 className={`${SITE.display} mb-12 text-center text-[28px] font-bold leading-[1.2] text-white sm:text-[35.2px]`}>{CLASSES.intro}</h2>
          <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[992px]:grid-cols-4">
            {CLASSES.items.map((c) => (
              <div key={c.icon} className="flex flex-col rounded-lg bg-white/5 px-6 py-8 text-center backdrop-blur-[10px] transition hover:-translate-y-1 hover:bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(c.icon)} alt={c.alt} loading="lazy" className="mx-auto mb-4 aspect-square w-1/2 rounded-full object-cover" />
                {/* Always two lines tall, so every card's description starts on the same line. */}
                <h3 className={`${SITE.display} mb-4 flex min-h-[2.4em] items-center justify-center text-[24px] font-bold leading-[1.2] text-white`}>
                  <span>
                    {c.title.map((l, i) => (
                      <span key={l}>
                        {i > 0 && <br />}
                        {l}
                      </span>
                    ))}
                  </span>
                </h3>
                <p className="mb-4 text-[16px] leading-[1.6] text-[#ccc]">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 bg-white py-24">
        <div className={SITE.container}>
          <h2 className={`${SITE.display} mb-12 text-center text-[34px] font-bold leading-[1.3] text-[#333] sm:text-[44.8px]`}>
            {ABOUT.title[0]} <Highlight>{ABOUT.title[1]}</Highlight>
          </h2>
          <div className="grid items-center gap-6 min-[992px]:grid-cols-2">
            <div>
              <p className="mb-12 text-[17.6px] leading-[1.8] text-[#666]">{ABOUT.text}</p>
              <p
                className="mb-8 rounded-[10px] border-l-4 border-[#ea3835] p-8 text-[22px] font-bold leading-[1.6] tracking-[0.5px] text-[#333] sm:text-[25.6px]"
                style={{ backgroundImage: "linear-gradient(135deg, rgba(234,56,53,0.05) 0%, rgba(248,155,70,0.05) 100%)" }}
              >
                {ABOUT.revolution[0]}
                <br />
                {ABOUT.revolution[1]}
              </p>
              <Link href="/register" className={SITE.button}>
                Move With Us
              </Link>
            </div>
            {/* 456px rounded frame with a light brand tint over the video, as on the original. */}
            <div className="relative mx-auto w-full max-w-[456px] overflow-hidden rounded-lg">
              <video autoPlay muted loop playsInline preload="metadata" className="block h-auto w-full object-cover min-[992px]:h-[400px]">
                <source src={asset(ABOUT.video)} type="video/mp4" />
              </video>
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{ backgroundImage: "linear-gradient(45deg, rgba(234,56,53,0.1), rgba(248,155,70,0.1))" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="relative overflow-hidden bg-white py-24">
        {/* Faint diagonal brand tint, as on the original. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ backgroundImage: "linear-gradient(45deg, rgba(234,56,53,0.03) 0%, rgba(248,155,70,0.03) 100%)" }}
        />
        <div className={`${SITE.container} relative text-center`}>
          <h2 className={`${SITE.display} relative mx-auto mb-12 w-fit text-[36px] font-bold leading-[1.2] text-[#333] sm:text-[48px]`}>
            Our Vision
            {/* 80 × 4 gradient underline, 10px below the heading */}
            <span className="absolute -bottom-[10px] left-1/2 h-1 w-20 -translate-x-1/2 rounded-[2px] bg-gradient-to-b from-[#ea3835] to-[#f89b46]" aria-hidden />
          </h2>
          <p className="mx-auto mb-12 max-w-[800px] text-[17px] leading-[1.8] text-[#666] sm:text-[19.2px]">{VISION}</p>
        </div>
      </section>

      {/* Instructors */}
      <section id="trainers" className="scroll-mt-20 bg-[#1a1a1a] py-24 text-white">
        <div className={SITE.container}>
          <div className="mb-12 text-center">
            <h2 className={`${SITE.display} mb-4 text-[32px] font-bold leading-[1.2] text-white sm:text-[40px]`}>
              Meet Our <Highlight>Team</Highlight>
            </h2>
            <p className="text-[16px] text-white">Passionate instructors who bring energy, skill, and inspiration to every class</p>
          </div>
          <TrainersSection />
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="scroll-mt-20 bg-white py-24">
        <div className={SITE.container}>
          <h2 className={`${SITE.display} mb-12 text-center text-[32px] font-bold leading-[1.2] text-[#333] sm:text-[40px]`}>
            Discover your <Highlight>Journey</Highlight>
          </h2>
          <div className="mb-12 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[992px]:grid-cols-4">
            {PROGRAMS.items.map((p) => (
              <div key={p.title} className="group relative h-[300px] overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(p.image)} alt={p.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                <div className="absolute inset-x-0 bottom-0 px-8 pb-6 pt-8 transition-opacity duration-300 group-hover:opacity-0" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7))" }}>
                  <h3 className={`${SITE.display} text-[22.4px] font-bold leading-[1.2] text-white`}>{p.title}</h3>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#ea3835]/90 to-[#f89b46]/90 p-6 text-center text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <h3 className={`${SITE.display} mb-2 text-[22.4px] font-bold leading-[1.2]`}>{p.title}</h3>
                  <p className="text-[15px] leading-[1.6] text-white/95">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="mb-6 text-[20px] leading-[1.6] text-[rgba(33,37,41,0.75)]">{PROGRAMS.outro}</p>
            <Link href="/register" className={SITE.button}>
              Sign Up Today <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="relative overflow-hidden py-24 text-white" style={{ backgroundImage: SITE.darkBg }}>
        {/* Red / orange glows, as on the original. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(234,56,53,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(248,155,70,0.15) 0%, transparent 50%), radial-gradient(circle, rgba(234,56,53,0.05) 0%, transparent 70%)",
          }}
        />
        <div className={`${SITE.container} relative text-center`}>
          <div className="flex items-center justify-center">
            <span className="hidden h-[3px] w-[60px] shrink-0 bg-gradient-to-b from-[#ea3835] to-[#f89b46] sm:block" aria-hidden />
            <h2 className={`${SITE.display} px-4 text-[38px] font-black leading-[1.1] text-white sm:text-[64px]`}>
              {CTA.title[0]} <span className={`${SITE.gradientText} font-bold`}>{CTA.title[1]}</span> {CTA.title[2]}
            </h2>
            <span className="hidden h-[3px] w-[60px] shrink-0 bg-gradient-to-b from-[#ea3835] to-[#f89b46] sm:block" aria-hidden />
          </div>
          <p className="mb-12 mt-6 text-[17px] leading-[1.6] text-[#b0b0b0] sm:text-[19.2px]">{CTA.text}</p>
          <Link href="/register" className={SITE.button}>
            Join Today <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <SiteFooter />
      <AnikaChat />
    </div>
  );
}
