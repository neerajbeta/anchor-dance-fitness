export const toneClass: Record<string, string> = {
  ok: "badge-ok",
  warn: "badge-warn",
  danger: "badge-danger",
  info: "badge-info",
  gray: "badge-gray",
  grape: "badge-grape",
  brand: "badge-brand",
};

export function Avatar({
  letter,
  color,
  size = 32,
}: {
  letter: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: color ?? "#EF5B2B",
      }}
    >
      {letter}
    </span>
  );
}

export function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        {sub && <p className="text-[13px] text-slate">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

