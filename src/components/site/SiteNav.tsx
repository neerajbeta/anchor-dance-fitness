"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Classes", href: "/#classes" },
  { label: "Instructors", href: "/#trainers" },
  { label: "Programs", href: "/#programs" },
  { label: "Schedule", href: "/schedule" },
];

/** Public website header. "Login" goes to the portal login; signed-in students see "My Portal". */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => setSignedIn(r.ok))
      .catch(() => {});
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-black/95 transition-shadow ${scrolled ? "shadow-[0_2px_20px_rgba(0,0,0,0.5)] backdrop-blur" : ""}`}>
      {/* Full width like the original (logo far left, links far right). */}
      <nav className="flex h-[82px] w-full items-center justify-between px-3">
        <Link href="/" className="inline-flex items-center no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-on-dark.webp" alt="Anchor Dance & Fitness" className="h-10 w-auto" />
        </Link>

        <div className="hidden items-center gap-8 min-[992px]:flex">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="px-2 py-2 text-[16px] font-medium text-white no-underline transition hover:text-[#f89b46]">
              {l.label}
            </Link>
          ))}
          <Link
            href={signedIn ? "/portal" : "/login"}
            className="ml-2 rounded-[50px] bg-gradient-to-b from-[#ea3835] to-[#f89b46] px-6 py-2 text-[15px] font-bold uppercase tracking-[1px] text-white no-underline transition hover:-translate-y-0.5"
          >
            {signedIn ? "My Portal" : "Login"}
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white min-[992px]:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-black/95 px-4 pb-4 min-[992px]:hidden">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-[16px] font-medium text-white no-underline">
              {l.label}
            </Link>
          ))}
          <Link
            href={signedIn ? "/portal" : "/login"}
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-[50px] bg-gradient-to-b from-[#ea3835] to-[#f89b46] py-2.5 text-center text-[15px] font-bold uppercase tracking-[1px] text-white no-underline"
          >
            {signedIn ? "My Portal" : "Login"}
          </Link>
        </div>
      )}
    </header>
  );
}
