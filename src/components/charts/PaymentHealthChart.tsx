"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Health = { paid: number; overdue: number; pending: number; onetime: number };

// Ordered so Overdue (red) never sits directly next to Paid (green) — the
// classic red/green pairing is hard to tell apart for deutan/protan viewers.
// Every segment also carries a text label, so identity is never color-alone.
const SEGMENTS: { key: keyof Health; label: string; color: string }[] = [
  { key: "paid", label: "Paid", color: "#2E9E6B" },
  { key: "pending", label: "Pending", color: "#E0972B" },
  { key: "overdue", label: "Overdue", color: "#DC4A3D" },
  { key: "onetime", label: "Waived", color: "#9C9086" },
];

const W = 560;
const H = 90;
const GAP = 2;

export function PaymentHealthChart({ data }: { data: Health }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.paid + data.overdue + data.pending + data.onetime;

  if (total === 0) {
    return <EmptyChart label="No registrations yet" />;
  }

  let x = 0;
  const bars = SEGMENTS.map((seg) => {
    const value = data[seg.key];
    const w = (value / total) * W;
    const bar = { ...seg, value, x, w };
    x += w;
    return bar;
  }).filter((b) => b.w > 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {bars.map((b, i) => (
          <rect
            key={b.key}
            x={b.x + (i > 0 ? GAP / 2 : 0)}
            y={20}
            width={Math.max(b.w - (i > 0 && i < bars.length - 1 ? GAP : GAP / 2), 1)}
            height={32}
            rx={4}
            fill={b.color}
            opacity={hover === null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
            className="cursor-default transition-opacity"
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
        {bars.map((b, i) => (
          <div
            key={b.key}
            className="flex items-center gap-1.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: b.color }} />
            <span className="font-semibold text-ink">{b.label}</span>
            <span className="text-muted">
              {b.value} · {Math.round((b.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
