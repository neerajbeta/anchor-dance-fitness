"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoWordmark } from "./Logo";
import { logoutAction } from "@/lib/auth/actions";
import { usePermissions } from "@/lib/usePermissions";

type NavItem = { href: string; label: string; icon: string; primary?: boolean; permission?: string };
const NAV: { section: string | null; items: NavItem[] }[] = [
  { section: null, items: [{ href: "/admin/registrations", label: "All Registrations", icon: "⊞", primary: true }] },
  {
    section: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: "📊", permission: "dashboard.view" },
      { href: "/admin/reports", label: "Reports", icon: "🏆", permission: "reports.view" },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/admin/classes", label: "Classes", icon: "💃", permission: "classes.view" },
      { href: "/admin/categories", label: "Categories", icon: "🏷️", permission: "categories.view" },
      { href: "/admin/levels", label: "Levels", icon: "🎚️", permission: "levels.view" },
      { href: "/admin/locations", label: "Locations", icon: "📍", permission: "locations.view" },
      { href: "/admin/discounts", label: "Discounts", icon: "🏷️", permission: "discounts.view" },
      { href: "/admin/plans", label: "Plans", icon: "💳", permission: "plans.view" },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/events", label: "Events & Workshops", icon: "🎭", permission: "events.view" },
      { href: "/admin/book-on-behalf", label: "Book on Behalf", icon: "✏️", permission: "book_on_behalf.view" },
      { href: "/admin/studio", label: "Studio Bookings", icon: "🏛️", permission: "studio.view" },
      { href: "/admin/payments", label: "Payments", icon: "💳", permission: "payments.view" },
      { href: "/admin/enquiries", label: "Enquiries", icon: "📨", permission: "enquiries.view" },
    ],
  },
  {
    section: "Comms",
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: "📩", permission: "announcements.view" },
      { href: "/admin/email-templates", label: "Email Templates", icon: "✉️", permission: "settings.view" },
    ],
  },
  {
    section: "User Management",
    items: [
      { href: "/admin/users", label: "Users", icon: "👥", permission: "users.view" },
      { href: "/admin/roles", label: "Roles & Permissions", icon: "🔐", permission: "roles.view" },
    ],
  },
  {
    section: "Settings",
    items: [{ href: "/admin/settings", label: "Portal Settings", icon: "⚙️", permission: "settings.view" }],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { can, loading } = usePermissions();
  // While /api/me is loading, show every item (avoids a flash-hide flicker); permission-gated
  // items are filtered out once the actor's permission set is known. Server-side checks are the
  // real authorization boundary regardless of what's shown here.
  const nav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || loading || can(item.permission)),
  })).filter((group) => group.items.length > 0);

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
          {nav.map((group, gi) => (
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
