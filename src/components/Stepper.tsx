export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-based index of active step
}) {
  return (
    <div className="mb-7 flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="contents">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-brand-500 text-white"
                    : active
                    ? "bg-ink text-white"
                    : "bg-line text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <div
                className={`text-center text-[11px] font-medium ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mb-6 h-0.5 flex-1 ${done ? "bg-brand-500" : "bg-line"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
