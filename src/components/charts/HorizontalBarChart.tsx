"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Item = { label: string; count: number };

const W = 400;
const ROW_H = 30;
const BAR_H = 14;
const PAD_L = 90;
const PAD_R = 34;

export function HorizontalBarChart({ data }: { data: Item[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <EmptyChart label="No data for this filter" />;
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const plotW = W - PAD_L - PAD_R;
  const h = data.length * ROW_H;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" style={{ height: h }}>
      {data.map((d, i) => {
        const barW = Math.max((d.count / max) * plotW, 3);
        const y = i * ROW_H + (ROW_H - BAR_H) / 2;
        return (
          <g
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
            className="cursor-default"
          >
            <text x={PAD_L - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize="11" fontWeight={600} fill="#4A4038">
              {d.label}
            </text>
            <rect x={PAD_L} y={y} width={plotW} height={BAR_H} rx={4} fill="#ECE4DA" />
            <rect
              x={PAD_L}
              y={y}
              width={barW}
              height={BAR_H}
              rx={4}
              fill={hover === i ? "#E0402A" : "#EF5B2B"}
              className="transition-colors"
            />
            <text x={PAD_L + barW + 6} y={y + BAR_H / 2 + 4} fontSize="11" fontWeight={700} fill="#2E2620">
              {d.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
