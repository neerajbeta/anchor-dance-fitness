type Mix = { online: number; offline: number; total: number };

export function ClassesMixChart({ data }: { data: Mix }) {
  if (data.total === 0) {
    return (
      <div className="flex h-[100px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-line bg-cream/30 text-[13px] text-muted">
        No active classes yet
      </div>
    );
  }

  return (
    <table className="dt">
      <thead>
        <tr>
          <th>Format</th>
          <th>Classes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="font-semibold">🟠 In-Person</td>
          <td className="font-bold text-ink">{data.offline}</td>
        </tr>
        <tr>
          <td className="font-semibold">🔵 Online</td>
          <td className="font-bold text-ink">{data.online}</td>
        </tr>
      </tbody>
    </table>
  );
}
