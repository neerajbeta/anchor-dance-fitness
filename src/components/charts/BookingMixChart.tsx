"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Mix = { classes: number; workshopsEvents: number; studio: number };

const SEGMENTS: { key: keyof Mix; label: string; color: string }[] = [
  { key: "classes", label: "Classes", color: "#3B82C4" },
  { key: "workshopsEvents", label: "Workshops & Events", color: "#E0972B" },
  { key: "studio", label: "Studio", color: "#8B5CF6" },
];

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 60;
const STROKE = 26;
const CIRC = 2 * Math.PI * R;

export function BookingMixChart({ data }: { data: Mix }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.classes + data.workshopsEvents + data.studio;

  if (total === 0) {
    return <EmptyChart label="No bookings yet" />;
  }

  let offset = 0;
  const arcs = SEGMENTS.map((seg) => {
    const value = data[seg.key];
    const frac = value / total;
    const len = frac * CIRC;
    const gap = 2;
    const arc = { ...seg, value, dasharray: `${Math.max(len - gap, 0)} ${CIRC - Math.max(len - gap, 0)}`, dashoffset: -offset };
    offset += len;
    return arc;
  }).filter((a) => a.value > 0);

  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="flex-shrink-0">
        {arcs.map((a, i) => (
          <circle
            key={a.key}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={hover === i ? STROKE + 4 : STROKE}
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={hover === null || hover === i ? 1 : 0.4}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
            className="cursor-default transition-all"
          />
        ))}
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize="20" fontWeight={800} fill="#2E2620">
          {total}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize="9" fill="#9C9086" fontWeight={600}>
          BOOKINGS
        </text>
      </svg>
      <div className="flex flex-col gap-2 text-[12px]">
        {arcs.map((a, i) => (
          <div
            key={a.key}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: a.color }} />
            <span className="font-semibold text-ink">{a.label}</span>
            <span className="text-muted">
              {a.value} · {Math.round((a.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
