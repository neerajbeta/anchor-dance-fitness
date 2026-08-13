"use client";

import Link from "next/link";
import { LogoWordmark } from "./Logo";

type NavLink = { label: string; href?: string; active?: boolean };

export function TopNav({
  links,
  right,
  meta,
}: {
  links?: NavLink[];
  right?: React.ReactNode;
  meta?: string;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center justify-between bg-ink px-5 md:px-7">
      <Link href="/portal" className="no-underline">
        <LogoWordmark size={30} />
      </Link>
      {links && (
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) =>
            l.href ? (
              <Link
                key={l.label}
                href={l.href}
                className={`nav-btn ${l.active ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ) : (
              <button key={l.label} className={`nav-btn ${l.active ? "active" : ""}`}>
                {l.label}
              </button>
            )
          )}
        </nav>
      )}
      {meta && <div className="text-[13px] text-white/50">{meta}</div>}
      {right}
    </header>
  );
}
