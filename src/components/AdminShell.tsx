"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoWordmark } from "./Logo";
import { logoutAction } from "@/lib/auth/actions";

type NavItem = { href: string; label: string; icon: string; primary?: boolean };
const NAV: { section: string | null; items: NavItem[] }[] = [
  { section: null, items: [{ href: "/admin/registrations", label: "All Registrations", icon: "⊞", primary: true }] },
  {
    section: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
      { href: "/admin/reports", label: "Reports", icon: "🏆" },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/admin/classes", label: "Classes", icon: "💃" },
      { href: "/admin/categories", label: "Categories", icon: "🏷️" },
      { href: "/admin/locations", label: "Locations", icon: "📍" },
      { href: "/admin/discounts", label: "Discounts", icon: "🏷️" },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/events", label: "Events & Workshops", icon: "🎭" },
      { href: "/admin/book-on-behalf", label: "Book on Behalf", icon: "✏️" },
      { href: "/admin/studio", label: "Studio Bookings", icon: "🏛️" },
      { href: "/admin/payments", label: "Payments", icon: "💳" },
      { href: "/admin/enquiries", label: "Enquiries", icon: "📨" },
    ],
  },
  { section: "Comms", items: [{ href: "#", label: "Announcements", icon: "📩" }] },
  {
    section: "Settings",
    items: [
      { href: "#", label: "Portal Settings", icon: "⚙️" },
      { href: "#", label: "User Management", icon: "👥" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center justify-between bg-ink px-5 md:px-7">
        <Link href="/admin/registrations" className="flex items-center gap-2 no-underline">
          <LogoWordmark size={30} />
          <span className="badge rounded bg-brand-500 text-white">ADMIN</span>
        </Link>
        <div className="flex items-center gap-3">
          <button className="relative nav-btn">
            🔔
            <span className="absolute -right-0 -top-0 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
              3
            </span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
            A
          </div>
          <form action={logoutAction}>
            <button type="submit" className="nav-btn">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-56 flex-shrink-0 flex-col gap-0.5 overflow-y-auto bg-ink p-3 md:flex">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.section && <div className="side-section">{group.section}</div>}
              {group.items.map((item) => {
                const active = path === item.href;
                if (item.primary) {
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`mb-1 flex items-center gap-2.5 rounded-lg border-[1.5px] px-2.5 py-2.5 text-[13px] font-bold transition-all ${
                        active
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-brand-500/40 bg-brand-500/20 text-white hover:bg-brand-500/30"
                      }`}
                    >
                      <span>{item.icon}</span> {item.label}
                      <span
                        className={`ml-auto rounded-lg px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${
                          active ? "bg-white text-brand-600" : "bg-brand-500 text-white"
                        }`}
                      >
                        PRIMARY
                      </span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`side-item ${active ? "active" : ""}`}
                  >
                    <span>{item.icon}</span> {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="side-section">Phase 2</div>
          <div className="side-item opacity-60">
            <span>🏋️</span> Trainer Management
            <span className="ml-auto rounded bg-white/15 px-1.5 py-0.5 text-[9px]">P2</span>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-cream-deep px-5 py-6 md:px-8">
          <div className="anim-fade">{children}</div>
        </main>
      </div>
    </div>
  );
}
