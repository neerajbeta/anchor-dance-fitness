"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { logoutUserAction } from "@/lib/auth/userActions";
import { Avatar } from "./Avatar";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle, ThemeToggleFab } from "./ThemeToggle";

// Plans isn't a top-level destination — it's reached as a step of booking a class.
const studentLinks = [
  { href: "/portal", label: "Home" },
  { href: "/book", label: "Book Session" },
];

// Checkout (/plans) is part of booking, so "Book Session" stays highlighted there too.
const BOOKING_PATHS = ["/book/", "/plans", "/confirmation"];

function isActive(pathname: string, href: string) {
  return pathname === href || (href === "/book" && BOOKING_PATHS.some((p) => pathname.startsWith(p)));
}

/**
 * Student nav for client pages that don't get the session from the server
 * (booking steps, plans, confirmation). Reads the signed-in user itself.
 *
 * Only a real 401 means "signed out". Any other failure (a dev server still
 * compiling the route, a dropped connection) is retried, so a signed-in
 * student never sees a stray "Sign In" button.
 */
export function SessionStudentNav() {
  // undefined = still checking, null = signed out
  const [user, setUser] = useState<{ name: string; email: string } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (attempt: number) => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) return setUser(null);
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (!cancelled) setUser(j?.data ?? null);
      } catch {
        if (cancelled) return;
        if (attempt >= 3) return setUser(null);
        timer = setTimeout(() => load(attempt + 1), 800 * (attempt + 1));
      }
    };
    load(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <StudentNav userName={user === undefined ? undefined : user?.name ?? null} userEmail={user?.email} />;
}

/** Avatar + name in the top-right corner, opening a small account menu. */
function ProfileMenu({ name, email }: { name: string; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstName = name.trim().split(/\s+/)[0] || name;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <Avatar name={name} size="sm" className="ring-2 ring-white/25" />
        <span className="max-w-[120px] truncate">{firstName}</span>
        <ChevronDown className={cn("h-4 w-4 text-white/60 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-sheet absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-xl border border-hairline bg-surface text-copy shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name}</div>
              {email ? <div className="truncate text-xs text-copy-dim">{email}</div> : null}
            </div>
          </div>
          <Link
            href="/portal"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-surface-muted"
          >
            <UserRound className="h-4 w-4 text-copy-dim" />
            My Portal
          </Link>
          <form action={logoutUserAction} className="border-t border-hairline">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-danger transition hover:bg-surface-muted"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SignOutButton({
  loggedIn,
  className,
}: {
  loggedIn: boolean;
  className?: string;
}) {
  if (!loggedIn) {
    return (
      <Link href="/login" className={className}>
        Sign In
      </Link>
    );
  }
  return (
    <form action={logoutUserAction}>
      <button type="submit" className={className}>
        Sign Out
      </button>
    </form>
  );
}

/**
 * `userName`: a name = signed in, `null` = signed out, `undefined` = still
 * checking (shows a placeholder instead of flashing "Sign In").
 */
export function StudentNav({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const loggedIn = Boolean(userName);
  const checking = userName === undefined;

  return (
    <header className="premium-nav sticky top-0 z-40 text-white">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4">
        <BrandLogo variant="dark" size="sm" href="/portal" />
        <nav className="hidden items-center gap-1 md:flex">
          {studentLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white",
                isActive(pathname, link.href) &&
                  "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(248,155,71,0.35)]",
              )}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle className="ml-1" tone="brand" />
          {checking ? (
            <span className="ml-2 h-8 w-24 animate-pulse rounded-full bg-white/10" aria-hidden />
          ) : loggedIn && userName ? (
            <ProfileMenu name={userName} email={userEmail} />
          ) : (
            <SignOutButton
              loggedIn={false}
              className="rounded-full px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            />
          )}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle tone="brand" showLabel={false} />
          {loggedIn && userName ? <Avatar name={userName} size="sm" className="ring-2 ring-white/25" /> : null}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Open menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          {loggedIn && userName ? (
            <div className="mb-2 flex items-center gap-3 border-b border-white/10 pb-3">
              <Avatar name={userName} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{userName}</div>
                {userEmail ? <div className="truncate text-xs text-white/60">{userEmail}</div> : null}
              </div>
            </div>
          ) : null}
          {studentLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2.5 text-sm"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <SignOutButton loggedIn={loggedIn} className="py-2.5 text-sm" />
        </div>
      ) : null}
      <div className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 shadow-[0_-8px_30px_rgba(20,17,16,0.08)] backdrop-blur-lg md:hidden">
        {studentLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex h-14 flex-col items-center justify-center text-[11px] font-semibold",
              isActive(pathname, link.href) ? "text-accent" : "text-copy-dim",
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}

export function StudentShell({
  children,
  userName,
  userEmail,
}: {
  children: ReactNode;
  userName?: string | null;
  userEmail?: string | null;
}) {
  return (
    <div className="app-canvas min-h-screen">
      {/* Server-rendered pages already know the session — never "still checking". */}
      <StudentNav userName={userName ?? null} userEmail={userEmail} />
      <main className="animate-enter mx-auto w-full max-w-6xl px-4 py-10 pb-24">{children}</main>
      <ThemeToggleFab />
    </div>
  );
}

export function PublicLayout({
  children,
  eyebrow,
  homeHref = "/",
}: {
  children: ReactNode;
  eyebrow?: string;
  homeHref?: string;
}) {
  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <header className="premium-nav sticky top-0 z-30 flex h-[68px] items-center justify-between px-5 text-white">
        <BrandLogo variant="dark" size="sm" href={homeHref} />
        <div className="flex items-center gap-3">
          {eyebrow ? <p className="hidden text-sm text-white/45 sm:block">{eyebrow}</p> : null}
          <ThemeToggle tone="brand" />
        </div>
      </header>
      <main className="animate-enter mx-auto w-full max-w-6xl flex-1 px-4 py-10 pb-20">{children}</main>
    </div>
  );
}

export function CoachShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const links = [{ href: "/coach", label: "My Batches" }];
  return (
    <div className="app-canvas min-h-screen">
      <header className="premium-nav sticky top-0 z-40 flex h-[68px] items-center justify-between px-4 text-white">
        <div className="flex items-center gap-2">
          <BrandLogo variant="dark" size="sm" href="/coach" />
          <span className="rounded-full bg-ok px-2.5 py-0.5 text-[10px] font-bold tracking-wide">
            COACH
          </span>
        </div>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition",
                pathname === link.href
                  ? "bg-white/12 text-accent-warm"
                  : "text-white/75 hover:bg-white/10",
              )}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle tone="brand" />
          <SignOutButton loggedIn className="px-3 text-sm text-white/75" />
        </nav>
      </header>
      <main className="animate-enter mx-auto max-w-6xl px-4 py-10">{children}</main>
      <ThemeToggleFab />
    </div>
  );
}
