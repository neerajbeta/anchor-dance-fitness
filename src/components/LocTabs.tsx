"use client";

import { useEffect, useState } from "react";

type Loc = { id: string; label: string; flag: string | null };

// Location filter tabs — loaded from /api/locations (dynamic, admin-managed).
export function LocTabs({ onChange }: { onChange?: (label: string) => void }) {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocs(j.data ?? []));
  }, []);

  const tabs = [{ id: "all", label: "🌍 All", value: "" }, ...locs.map((l) => ({ id: l.id, label: `${l.flag ?? ""} ${l.label}`, value: l.label }))];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[13px] text-muted">📍</span>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setActive(t.value);
            onChange?.(t.value);
          }}
          className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            active === t.value
              ? "border-ink bg-ink text-white"
              : "border-line bg-white text-slate hover:border-brand-400 hover:text-brand-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
