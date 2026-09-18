import Link from "next/link";

type Health = { paid: number; overdue: number; pending: number; onetime: number };

const ROWS: { key: keyof Health; label: string; dot: string }[] = [
  { key: "paid", label: "🟢 Paid", dot: "#2E9E6B" },
  { key: "pending", label: "🟠 Pending", dot: "#E0972B" },
  { key: "overdue", label: "🔴 Overdue", dot: "#DC4A3D" },
  { key: "onetime", label: "⚪ Waived", dot: "#9C9086" },
];

export function PaymentHealthChart({ data }: { data: Health }) {
  const total = data.paid + data.overdue + data.pending + data.onetime;

  if (total === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-line bg-cream/30 text-[13px] text-muted">
        No registrations yet
      </div>
    );
  }

  const rows = ROWS.filter((r) => data[r.key] > 0);

  return (
    <div>
      <table className="dt">
        <thead>
          <tr>
            <th>Status</th>
            <th>Payments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-semibold">{r.label}</td>
              <td className="font-bold text-ink">{data[r.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.overdue > 0 && (
        <div className="mt-3 text-right">
          <Link href="/admin/payments" className="text-[12px] font-semibold text-brand-600 hover:underline">
            {data.overdue} overdue → View payments
          </Link>
        </div>
      )}
    </div>
  );
}
