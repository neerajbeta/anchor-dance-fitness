"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Loc = { id: string; label: string; flag: string | null };

export function DashboardLocationFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locs, setLocs] = useState<Loc[]>([]);
  const current = searchParams.get("location") ?? "";

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setLocs(j.data ?? []));
  }, []);

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("location", value);
    else params.delete("location");
    router.push(`/admin/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <select
      className="field w-auto text-[13px]"
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Location: All</option>
      {locs.map((l) => (
        <option key={l.id} value={l.label}>
          Location: {l.flag ?? ""} {l.label}
        </option>
      ))}
    </select>
  );
}
