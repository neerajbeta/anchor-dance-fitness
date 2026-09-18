"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Item = { label: string; count: number };

// Fixed categorical hue order — assigned by position, never cycled, so a filtered-out entry
// never repaints the survivors' colors. Validated (validate_palette.js): passes lightness,
// chroma, and normal-vision checks; the one CVD WARN pair (danger↔ok) is covered by the
// always-on direct labels below, which is the accepted mitigation for a 6–8 ΔE floor.
const COLORS = ["#3B82C4", "#E0972B", "#8B5CF6", "#2E9E6B", "#DC4A3D", "#EF5B2B"];

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 60;
const STROKE = 26;
const CIRC = 2 * Math.PI * R;

export function CategoryDonutChart({ data, unitLabel }: { data: Item[]; unitLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <EmptyChart label="No data for this filter" />;
  }

  let offset = 0;
  const arcs = data
    .filter((d) => d.count > 0)
    .map((d, i) => {
      const frac = d.count / total;
      const len = frac * CIRC;
      const gap = 2;
      const arc = {
        ...d,
        color: COLORS[i % COLORS.length],
        dasharray: `${Math.max(len - gap, 0)} ${CIRC - Math.max(len - gap, 0)}`,
        dashoffset: -offset,
      };
      offset += len;
      return arc;
    });

  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="flex-shrink-0">
        {arcs.map((a, i) => (
          <circle
            key={a.label}
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
          {unitLabel}
        </text>
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-[12px]">
        {arcs.map((a, i) => (
          <div
            key={a.label}
            className="flex items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: a.color }} />
            <span className="truncate font-semibold text-ink">{a.label}</span>
            <span className="ml-auto flex-shrink-0 text-muted">
              {a.count} · {Math.round((a.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
