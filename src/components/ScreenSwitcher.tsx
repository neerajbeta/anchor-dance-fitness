"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const GROUPS: { label: string; color: string; items: [string, string][] }[] = [
  {
    label: "USER",
    color: "#EF5B2B",
    items: [
      ["Login", "/login"],
      ["Register", "/register"],
      ["Book Home", "/book"],
      ["Book Class", "/book/class"],
      ["Workshops", "/book/workshops"],
      ["Book Studio", "/book/studio"],
      ["Plans & Pay", "/plans"],
      ["Confirmation", "/confirmation"],
      ["My Portal", "/portal"],
      ["Add Member", "/add-member"],
    ],
  },
  {
    label: "ADMIN",
    color: "#E0972B",
    items: [
      ["🔐 Admin Login", "/admin/login"],
      ["★ All Registrations", "/admin/registrations"],
      ["Dashboard", "/admin/dashboard"],
      ["Events & Workshops", "/admin/events"],
      ["Studio", "/admin/studio"],
      ["Book on Behalf", "/admin/book-on-behalf"],
      ["Payments", "/admin/payments"],
    ],
  },
  {
    label: "COACH",
    color: "#2E9E6B",
    items: [["Coach Portal", "/coach"]],
  },
];

export function ScreenSwitcher() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg text-white shadow-pop transition-transform hover:scale-105"
        title="Screen switcher"
      >
        {open ? "✕" : "⚓"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[60] max-h-[75vh] w-72 overflow-y-auto rounded-2xl border border-white/10 bg-ink/95 p-4 text-white shadow-pop backdrop-blur animate-scale-in">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">
            Screen Switcher
          </div>
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-4">
              <div
                className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: g.color }}
              >
                {g.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {g.items.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      path === href
                        ? "bg-brand-500 font-semibold text-white"
                        : "text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
