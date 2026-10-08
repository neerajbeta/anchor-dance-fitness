import Link from "next/link";
import { CONTACT, FOOTER_TEXT } from "@/lib/site/content";
import { SITE } from "./styles";

function SocialIcon({ name }: { name: "facebook" | "instagram" | "youtube" }) {
  const paths = {
    facebook: "M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z",
    instagram:
      "M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0ZM21 7c-.1-1.6-.4-3-1.6-4.2C18.2 1.6 16.8 1.3 15.2 1.2 13.6 1.1 10.4 1.1 8.8 1.2 7.2 1.3 5.8 1.6 4.6 2.8 3.4 4 3.1 5.4 3 7c-.1 1.6-.1 4.8 0 6.4.1 1.6.4 3 1.6 4.2 1.2 1.2 2.6 1.5 4.2 1.6 1.6.1 4.8.1 6.4 0 1.6-.1 3-.4 4.2-1.6 1.2-1.2 1.5-2.6 1.6-4.2.1-1.6.1-4.8 0-6.4Z",
    youtube:
      "M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8ZM9.8 15.1V8.9L15.5 12l-5.7 3.1Z",
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

function ContactIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-lg bg-white/10 text-[16px] text-[#ea3835]" aria-hidden>
      {children}
    </span>
  );
}

// "Follow Us" is small caps; the column titles are bigger and in normal case — as on the original.
const heading = `${SITE.display} text-[16px] font-semibold uppercase tracking-[1px] text-white`;
const colHeading = `${SITE.display} relative mb-6 text-[20.8px] font-bold leading-[1.2] text-white`;

/** Column title with the original's 40 × 3 gradient underline, 8px below. */
function ColHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className={colHeading}>
      {children}
      <span className="absolute -bottom-2 left-0 h-[3px] w-10 rounded-[2px] bg-gradient-to-b from-[#ea3835] to-[#f89b46]" aria-hidden />
    </h4>
  );
}
const link = "text-[15.2px] text-[#b0b0b0] no-underline transition hover:text-[#f89b46]";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden pb-8 pt-20 text-white" style={{ backgroundImage: "linear-gradient(135deg, #1a1a1a 0%, #000 100%)" }}>
      {/* Soft red / orange glows, as on the original. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(234,56,53,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(248,155,70,0.05) 0%, transparent 50%)",
        }}
      />
      <div className={`${SITE.container} relative grid gap-6 min-[768px]:grid-cols-2 min-[992px]:grid-cols-[526fr_306fr_416fr]`}>
        <div>
          <Link href="/" className="inline-block no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-on-dark.webp" alt="Anchor Dance & Fitness" className="h-[70px] w-auto" />
          </Link>
          <p className="mb-8 mt-4 text-[15.2px] leading-[1.6] text-[#b0b0b0]">{FOOTER_TEXT}</p>
          <h4 className={`${heading} mb-4 leading-[1.2]`}>Follow Us</h4>
          <div className="mb-8 flex gap-3">
            {CONTACT.social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-[45px] w-[45px] items-center justify-center rounded-xl bg-gradient-to-b from-[#ea3835] to-[#f89b46] text-white transition hover:-translate-y-1"
              >
                <SocialIcon name={s.icon} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <ColHeading>Quick Links</ColHeading>
          <ul>
            {[
              ["Classes", "/#classes"],
              ["Instructors", "/#trainers"],
              ["Programs", "/#programs"],
              ["Schedule", "/schedule"],
              ["Login", "/login"],
            ].map(([l, h]) => (
              <li key={l} className="mb-[12.8px] leading-[1.6]">
                <Link href={h} className={link}>
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ColHeading>Get In Touch</ColHeading>
          {/* Icon box + text, 16px apart — the addresses share one item, as on the original. */}
          <ul className="text-[14.4px] leading-[1.4] text-[#b0b0b0]">
            <li className="mb-4 flex items-center gap-4">
              <ContactIcon>☎</ContactIcon>
              <a href={CONTACT.phoneHref} className="text-[14.4px] text-[#b0b0b0] no-underline transition hover:text-[#f89b46]">
                {CONTACT.phone}
              </a>
            </li>
            <li className="mb-4 flex items-center gap-4">
              <ContactIcon>✉</ContactIcon>
              <a href={`mailto:${CONTACT.email}`} className="text-[14.4px] text-[#b0b0b0] no-underline transition hover:text-[#f89b46]">
                {CONTACT.email}
              </a>
            </li>
            <li className="flex items-center gap-4">
              <ContactIcon>⌖</ContactIcon>
              <div className="space-y-[17px]">
                {CONTACT.addresses.map((a) => (
                  <p key={a}>{a}</p>
                ))}
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div className={`${SITE.container} relative mt-12 border-t border-white/10 pt-8 text-[14.4px] leading-[1.6] text-[#999]`}>
        © {new Date().getFullYear()} Anchor Dance &amp; Fitness . All rights reserved.
      </div>
    </footer>
  );
}
