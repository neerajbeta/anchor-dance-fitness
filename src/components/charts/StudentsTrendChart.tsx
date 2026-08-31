"use client";

import { useState } from "react";
import { EmptyChart } from "./RevenueTrendChart";

type Point = { month: string; total: number };

const W = 560;
const H = 200;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const COLOR = "#3B82C4"; // same blue used for "Classes" elsewhere — students correlate with classes, not revenue

export function StudentsTrendChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return <EmptyChart label="No students yet" />;
  }

  const max = Math.max(...data.map((d) => d.total), 1);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const xOf = (i: number) => PAD_L + i * stepX;
  const yOf = (v: number) => PAD_T + plotH - (v / max) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(d.total)}`).join(" ");
  const areaPath = `${linePath} L ${xOf(data.length - 1)} ${PAD_T + plotH} L ${xOf(0)} ${PAD_T + plotH} Z`;

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = Math.round((max / yTicks) * i);
    return { y: yOf(v), v };
  });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={g.y} y2={g.y} stroke="#ECE4DA" strokeWidth={1} />
            <text x={PAD_L - 8} y={g.y + 3} textAnchor="end" fontSize="9" fill="#9C9086">
              {g.v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={COLOR} opacity={0.08} />
        <path d={linePath} fill="none" stroke={COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={xOf(i) - stepX / 2}
              y={PAD_T}
              width={stepX || plotW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
            <circle
              cx={xOf(i)}
              cy={yOf(d.total)}
              r={hover === i ? 5 : 3}
              fill={COLOR}
              stroke="#fff"
              strokeWidth={1.5}
              className="pointer-events-none transition-all"
            />
            <text x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#7A6F63" fontWeight={600}>
              {d.month}
            </text>
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-pop"
          style={{
            left: `${(xOf(hover) / W) * 100}%`,
            top: `${(yOf(data[hover].total) / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          {data[hover].month}: {data[hover].total} student{data[hover].total === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
