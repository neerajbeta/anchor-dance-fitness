"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHead } from "@/components/ui";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { usePermissions } from "@/lib/usePermissions";

type Seats = { capacity: number; booked: number; held: number; left: number | null; full: boolean } | null;
type WaitEntry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "waiting" | "offered";
  offerExpiresAt: string | null;
  createdAt: string;
};
type Item = {
  kind: "class" | "event";
  type: string;
  id: string;
  title: string;
  subtitle: string;
  dates: string;
  location: string;
  mode: "online" | "offline";
  category: string;
  seats: Seats;
  waitlist: WaitEntry[];
};

type StatusFilter = "" | "full" | "almost" | "open" | "waiting";

const TYPE_LABEL: Record<string, string> = { class: "💃 Class", workshop: "🎭 Workshop", event: "⭐ Event" };
const REFRESH_MS = 30_000;

function fillPct(s: Seats) {
  if (!s || s.capacity <= 0) return 0;
  return Math.min(100, Math.round(((s.booked + s.held) / s.capacity) * 100));
}
function statusOf(s: Seats): "full" | "almost" | "open" | "unlimited" {
  if (!s || s.capacity <= 0) return "unlimited";
  if (s.full) return "full";
  return fillPct(s) >= 80 ? "almost" : "open";
}

export function CapacityClient() {
  const { can } = usePermissions();
  const canEdit = can("classes.edit") || can("events.edit");

  const [items, setItems] = useState<Item[]>([]);
  const [at, setAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/capacity", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load capacity");
      setItems(j.data);
      setAt(j.at);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load capacity");
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time: refresh every 30 s while the page is open.
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const locations = useMemo(() => Array.from(new Set(items.map((i) => i.location))).sort(), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (type && i.type !== type) return false;
      if (location && i.location !== location) return false;
      const st = statusOf(i.seats);
      if (status === "full" && st !== "full") return false;
      if (status === "almost" && st !== "almost") return false;
      if (status === "open" && st !== "open" && st !== "unlimited") return false;
      if (status === "waiting" && i.waitlist.length === 0) return false;
      if (term && ![i.title, i.subtitle, i.location, i.category].some((f) => f.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, q, type, location, status]);

  const totals = useMemo(() => {
    let capacity = 0,
      filled = 0,
      full = 0,
      almost = 0,
      waiting = 0;
    for (const i of items) {
      const s = i.seats;
      if (s && s.capacity > 0) {
        capacity += s.capacity;
        filled += Math.min(s.capacity, s.booked + s.held);
      }
      const st = statusOf(s);
      if (st === "full") full++;
      if (st === "almost") almost++;
      waiting += i.waitlist.filter((w) => w.status === "waiting").length;
    }
    return { capacity, filled, free: Math.max(0, capacity - filled), full, almost, waiting };
  }, [items]);

  async function act(body: object, okMsg?: (j: { data?: { notified?: { name: string }[] } }) => string | null) {
    const res = await fetch("/api/capacity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j.error || "Something went wrong");
      return false;
    }
    const msg = okMsg?.(j);
    if (msg) alert(msg);
    await load();
    return true;
  }

  return (
    <>
      <SectionHead
        title="Batch Capacity"
        sub="Seats filled vs available for every class, workshop and event — updates every 30 seconds"
        right={
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> Live
              {at ? ` · updated ${new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={load}>
              ↻ Refresh
            </button>
            <ExportExcelButton
              rows={filtered}
              filename="Batch-capacity"
              sheetName="Capacity"
              notes={[`Batch Capacity — ${filtered.length} of ${items.length} batches`]}
              columns={[
                { label: "Type", value: (i) => TYPE_LABEL[i.type]?.replace(/^\S+\s/, "") ?? i.type },
                { label: "Title", value: (i) => i.title },
                { label: "Detail", value: (i) => i.subtitle },
                { label: "Dates", value: (i) => i.dates },
                { label: "Location", value: (i) => i.location },
                { label: "Mode", value: (i) => (i.mode === "online" ? "Online" : "In-person") },
                { label: "Category", value: (i) => i.category },
                { label: "Capacity", value: (i) => i.seats?.capacity ?? "" },
                { label: "Booked", value: (i) => i.seats?.booked ?? "" },
                { label: "Held (paying)", value: (i) => i.seats?.held ?? "" },
                { label: "Seats left", value: (i) => i.seats?.left ?? "" },
                { label: "Filled %", value: (i) => (i.seats?.capacity ? fillPct(i.seats) : "") },
                { label: "Status", value: (i) => statusOf(i.seats) },
                { label: "Waitlist", value: (i) => i.waitlist.length },
                { label: "Waitlist names", value: (i) => i.waitlist.map((w) => `${w.name} <${w.email}>`).join("; ") },
              ]}
            />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Seats filled" value={loading ? "—" : `${totals.filled} / ${totals.capacity}`} sub={`${totals.capacity ? Math.round((totals.filled / totals.capacity) * 100) : 0}% across all batches`} />
        <Tile label="Seats available" value={loading ? "—" : String(totals.free)} sub="Still bookable" tone="!text-ok" />
        <Tile label="🔴 Full" value={loading ? "—" : String(totals.full)} sub="No seats left" tone="!text-danger" onClick={() => setStatus(status === "full" ? "" : "full")} active={status === "full"} />
        <Tile label="🟠 Almost full" value={loading ? "—" : String(totals.almost)} sub="80% or more booked" tone="!text-warn" onClick={() => setStatus(status === "almost" ? "" : "almost")} active={status === "almost"} />
        <Tile label="⏳ Waiting" value={loading ? "—" : String(totals.waiting)} sub="People on waitlists" onClick={() => setStatus(status === "waiting" ? "" : "waiting")} active={status === "waiting"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 shadow-card">
        <div className="flex min-w-[200px] flex-[1.4] items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2">
          <span className="text-sm">🔍</span>
          <input className="min-w-0 flex-1 border-none bg-transparent text-xs text-ink outline-none" placeholder="Search class or event…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field w-auto min-w-[130px] flex-1 px-2 py-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="class">💃 Classes</option>
          <option value="workshop">🎭 Workshops</option>
          <option value="event">⭐ Events</option>
        </select>
        <select className="field w-auto min-w-[130px] flex-1 px-2 py-2 text-xs" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className="field w-auto min-w-[130px] flex-1 px-2 py-2 text-xs" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">Any status</option>
          <option value="full">🔴 Full</option>
          <option value="almost">🟠 Almost full</option>
          <option value="open">🟢 Open</option>
          <option value="waiting">⏳ Has a waitlist</option>
        </select>
      </div>

      {error && <div className="mb-3 rounded-lg bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-line/70 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="dt">
            <thead>
              <tr>
                <th>Class / Event</th>
                <th>Location</th>
                <th className="min-w-[220px]">Seats</th>
                <th>Waitlist</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    {items.length ? "Nothing matches these filters." : "No active classes or upcoming events."}
                  </td>
                </tr>
              )}
              {filtered.map((i) => (
                <Row
                  key={i.id}
                  i={i}
                  expanded={open === i.id}
                  onToggle={() => setOpen(open === i.id ? null : i.id)}
                  canEdit={canEdit}
                  onNotify={() =>
                    act({ action: "notify", kind: i.kind, id: i.id }, (j) =>
                      j.data?.notified?.length ? `Seat offered to ${j.data.notified.map((n) => n.name).join(", ")} — they've been emailed.` : "Nobody is waiting."
                    )
                  }
                  onRemove={(w) => {
                    if (confirm(`Remove ${w.name} from the waitlist?`)) void act({ action: "remove", entryId: w.id });
                  }}
                  onAdd={(email) => act({ action: "add", type: i.type, classId: i.kind === "class" ? i.id : undefined, eventId: i.kind === "event" ? i.id : undefined, email })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-2 text-[12px] text-muted">
        Seats count paid bookings, bookings awaiting payment (a checkout holds its seat for 30 minutes) and seats held for someone on the waitlist (24 hours).
      </div>
    </>
  );
}

function Tile({ label, value, sub, tone = "", onClick, active }: { label: string; value: string; sub: string; tone?: string; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`stat text-left ${active ? "!border-brand-500 ring-2 ring-brand-500/30" : ""}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </Tag>
  );
}

function Row({
  i,
  expanded,
  onToggle,
  canEdit,
  onNotify,
  onRemove,
  onAdd,
}: {
  i: Item;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onNotify: () => void;
  onRemove: (w: WaitEntry) => void;
  onAdd: (email: string) => Promise<boolean>;
}) {
  const s = i.seats;
  const st = statusOf(s);
  const pct = fillPct(s);
  const barColor = st === "full" ? "bg-danger" : st === "almost" ? "bg-warn" : "bg-ok";
  const waiting = i.waitlist.filter((w) => w.status === "waiting").length;
  const offered = i.waitlist.filter((w) => w.status === "offered").length;
  const [email, setEmail] = useState("");

  return (
    <>
      <tr>
        <td>
          <div className="font-bold text-ink">{i.title}</div>
          <div className="text-[11px] text-muted">
            {TYPE_LABEL[i.type] ?? i.type} · {i.subtitle}
            {i.dates && i.kind === "class" ? ` · ${i.dates}` : ""}
          </div>
        </td>
        <td className="whitespace-nowrap text-[12px]">
          {i.location}
          <div className="text-[10px] text-muted">{i.mode === "online" ? "💻 Online" : "🏃 In-Person"}</div>
        </td>
        <td>
          {!s || s.capacity <= 0 ? (
            <span className="text-[12px] text-muted">No seat limit</span>
          ) : (
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-bold text-ink">
                  {s.booked + s.held} / {s.capacity} filled
                </span>
                <span className={`font-semibold ${st === "full" ? "text-danger" : st === "almost" ? "text-warn" : "text-ok"}`}>
                  {st === "full" ? "FULL" : `${s.left} left`}
                </span>
              </div>
              <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-line/60" title={`${s.booked} booked · ${s.held} held for waitlist · ${s.left ?? 0} free`}>
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} />
                {s.held > 0 && <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, (s.held / s.capacity) * 100)}%` }} />}
              </div>
              {s.held > 0 && <div className="mt-0.5 text-[10px] text-info">{s.held} held for the waitlist</div>}
              {s.booked > s.capacity && <div className="mt-0.5 text-[10px] font-semibold text-danger">Over capacity by {s.booked - s.capacity}</div>}
              <span className="sr-only">{pct}% full</span>
            </div>
          )}
        </td>
        <td className="whitespace-nowrap text-[12px]">
          {i.waitlist.length === 0 ? (
            <span className="text-muted">—</span>
          ) : (
            <>
              {waiting > 0 && <span className="badge badge-warn">⏳ {waiting} waiting</span>}
              {offered > 0 && <span className="badge badge-info ml-1">🎟️ {offered} offered</span>}
            </>
          )}
        </td>
        <td>
          <button className="btn btn-ghost btn-sm" onClick={onToggle}>
            {expanded ? "Hide" : "Waitlist"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-cream/30">
            <div className="flex flex-wrap items-center justify-between gap-2 py-1">
              <div className="text-[13px] font-bold text-ink">Waitlist — first come, first served</div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <input className="field w-56 py-1.5 text-[12px]" placeholder="Student email to add" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={!email.trim()}
                    onClick={async () => {
                      if (await onAdd(email.trim())) setEmail("");
                    }}
                  >
                    + Add
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={waiting === 0} onClick={onNotify} title="Email the next person and hold a seat for them for 24 hours">
                    🔔 Notify next
                  </button>
                </div>
              )}
            </div>
            {i.waitlist.length === 0 ? (
              <div className="py-3 text-[12px] text-muted">Nobody is waiting. Students can join the waitlist from the booking page once this is full.</div>
            ) : (
              <table className="mt-2 w-full text-left text-[12px]">
                <tbody>
                  {i.waitlist.map((w, idx) => (
                    <tr key={w.id} className="border-t border-line">
                      <td className="w-8 py-2 font-bold text-muted">#{idx + 1}</td>
                      <td className="py-2">
                        <div className="font-semibold text-ink">{w.name}</div>
                        <div className="text-[11px] text-muted">
                          {w.email}
                          {w.phone ? ` · ${w.phone}` : ""}
                        </div>
                      </td>
                      <td className="py-2 text-[11px] text-muted">Joined {new Date(w.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2">
                        {w.status === "offered" ? (
                          <span className="badge badge-info">
                            🎟️ Seat offered · until {w.offerExpiresAt ? new Date(w.offerExpiresAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        ) : (
                          <span className="badge badge-warn">⏳ Waiting</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {canEdit && (
                          <button className="btn btn-ghost btn-sm" onClick={() => onRemove(w)}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
