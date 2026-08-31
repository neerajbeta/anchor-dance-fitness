"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Bar = { location: string; count: number };

const W = 560;
const H = 200;
const PAD_T = 20;
const PAD_B = 28;
const PAD_X = 8;
const BAR_GAP = 10;

export function LocationBarChart({ data }: { data: Bar[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <EmptyChart label="No registrations yet" />;
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const plotH = H - PAD_T - PAD_B;
  const plotW = W - PAD_X * 2;
  const slot = plotW / data.length;
  const barW = Math.max(slot - BAR_GAP, 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((d, i) => {
        const h = (d.count / max) * plotH;
        const x = PAD_X + i * slot + (slot - barW) / 2;
        const y = PAD_T + plotH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={3}
              fill={hover === i ? "#E0402A" : "#EF5B2B"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((prev) => (prev === i ? null : prev))}
              className="cursor-default transition-colors"
            />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700} fill="#4A4038">
              {d.count}
            </text>
            <text
              x={x + barW / 2}
              y={PAD_T + plotH + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight={600}
              fill="#7A6F63"
            >
              {d.location.length > 9 ? `${d.location.slice(0, 8)}…` : d.location}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
