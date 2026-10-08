"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Summary = {
  unpaid: number;
  customers: number;
  owed: number;
  due: number;
  escalated: number;
  top: {
    id: string;
    name: string;
    email: string;
    amount: number;
    detail: string | null;
    daysUnpaid: number;
    remindersSent: number;
    escalated: boolean;
    due: boolean;
    nextChannel: string | null;
  }[];
};

const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE")}`;
const CH: Record<string, string> = { sms: "SMS", email: "Email", whatsapp: "WhatsApp" };

/** Admin header bell: unpaid customers, reminders due, and escalations. */
export function NotificationBell() {
  const [data, setData] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch("/api/reminders/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function remind(id: string) {
    setSending(id);
    try {
      const res = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", id }) });
      const j = await res.json().catch(() => ({}));
      alert(j.data?.message ?? j.error ?? "Done");
      load();
    } finally {
      setSending(null);
    }
  }

  const count = data ? data.customers : 0;
  const urgent = data ? data.escalated > 0 : false;

  return (
    <div ref={ref} className="relative">
      <button
        className="relative nav-btn"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={data ? `${count} unpaid customer${count === 1 ? "" : "s"}` : "Notifications"}
        title={data ? `${count} unpaid · ${data.due} reminder${data.due === 1 ? "" : "s"} due · ${data.escalated} escalated` : "Notifications"}
      >
        🔔
        {count > 0 && (
          <span className={`absolute -right-0 -top-0 rounded-full px-1.5 text-[10px] font-bold text-white ${urgent ? "bg-danger" : "bg-brand-500"}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] overflow-hidden rounded-xl border border-line bg-white text-ink shadow-pop">
          <div className="border-b border-line px-4 py-3">
            <div className="font-display text-[15px] font-bold">Unpaid customers</div>
            {data ? (
              <div className="mt-0.5 text-[12px] text-muted">
                {data.customers} customer{data.customers === 1 ? "" : "s"} · {data.unpaid} booking{data.unpaid === 1 ? "" : "s"} · {sek(data.owed)} owed
              </div>
            ) : (
              <div className="mt-0.5 text-[12px] text-muted">You don&apos;t have access to payments.</div>
            )}
          </div>

          {data && (data.escalated > 0 || data.due > 0) && (
            <div className="flex gap-2 border-b border-line px-4 py-2 text-[11px]">
              {data.escalated > 0 && <span className="badge badge-danger">🚨 {data.escalated} need a personal follow-up</span>}
              {data.due > 0 && <span className="badge badge-warn">⏰ {data.due} reminder{data.due === 1 ? "" : "s"} due</span>}
            </div>
          )}

          <div className="max-h-[340px] overflow-y-auto">
            {data && data.top.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted">🎉 Everyone has paid.</div>}
            {data?.top.map((u) => (
              <div key={u.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold">{u.name}</div>
                    <div className="truncate text-[11px] text-muted">
                      {u.detail ?? u.id} · {u.daysUnpaid} day{u.daysUnpaid === 1 ? "" : "s"} unpaid
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[13px] font-bold">{sek(u.amount)}</div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1" title={`${u.remindersSent} of 3 reminders sent`}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`h-1.5 w-5 rounded-full ${i < u.remindersSent ? (u.escalated ? "bg-danger" : "bg-brand-500") : "bg-line"}`} />
                    ))}
                    <span className="ml-1 text-[10px] text-muted">
                      {u.escalated ? "Escalated — call them" : `${u.remindersSent}/3 sent${u.due ? " · due now" : ""}`}
                    </span>
                  </div>
                  {!u.escalated && (
                    <button className="btn btn-ghost btn-sm" disabled={sending === u.id} onClick={() => remind(u.id)} title={`Send reminder ${u.remindersSent + 1} (${CH[u.nextChannel ?? "email"]})`}>
                      {sending === u.id ? "…" : `Remind (${CH[u.nextChannel ?? "email"]})`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link href="/admin/reminders" className="block border-t border-line bg-cream/50 px-4 py-2.5 text-center text-[12px] font-semibold text-brand-600 no-underline hover:bg-cream" onClick={() => setOpen(false)}>
            Open Payment Reminders →
          </Link>
        </div>
      )}
    </div>
  );
}
