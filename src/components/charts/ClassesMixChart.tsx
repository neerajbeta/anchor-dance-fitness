"use client";

import { EmptyChart } from "./RevenueTrendChart";

type Mix = { online: number; offline: number; total: number };

const ONLINE_COLOR = "#3B82C4";
const OFFLINE_COLOR = "#E0972B";

const W = 400;
const H = 28;

export function ClassesMixChart({ data }: { data: Mix }) {
  if (data.total === 0) {
    return <EmptyChart label="No active classes yet" />;
  }

  const onlineW = (data.online / data.total) * W;
  const offlineW = W - onlineW;

  return (
    <div>
      <div className="mb-3 flex items-end gap-2">
        <div className="font-display text-3xl font-extrabold text-ink">{data.total}</div>
        <div className="mb-1 text-[12px] font-semibold text-muted">active classes</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <rect x={0} y={0} width={W} height={H} rx={6} fill="#ECE4DA" />
        {data.online > 0 && <rect x={0} y={0} width={onlineW} height={H} rx={6} fill={ONLINE_COLOR} />}
        {data.offline > 0 && (
          <rect x={onlineW} y={0} width={offlineW} height={H} rx={6} fill={OFFLINE_COLOR} />
        )}
      </svg>

      <div className="mt-3 flex flex-col gap-2 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: ONLINE_COLOR }} />
          <span className="font-semibold text-ink">💻 Online</span>
          <span className="text-muted">
            {data.online} · {Math.round((data.online / data.total) * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: OFFLINE_COLOR }} />
          <span className="font-semibold text-ink">🏃 In-Person</span>
          <span className="text-muted">
            {data.offline} · {Math.round((data.offline / data.total) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
