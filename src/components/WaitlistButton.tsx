"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/theme/Button";
import { Badge } from "@/components/theme/Card";
import { Input } from "@/components/theme/Input";
import { Modal } from "@/components/theme/Modal";

export type MyWaitlistEntry = {
  id: string;
  classId: string | null;
  eventId: string | null;
  status: "waiting" | "offered";
  offerExpiresAt: string | null;
};

/** The signed-in student's waitlist entries (empty when signed out). */
export function useMyWaitlist() {
  const [entries, setEntries] = useState<MyWaitlistEntry[]>([]);
  const reload = () =>
    fetch("/api/waitlist", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setEntries(j.data ?? []))
      .catch(() => {});
  useEffect(() => {
    reload();
  }, []);
  return { entries, reload };
}

/**
 * "Join Waitlist" for a full class / workshop / event. A signed-in student
 * joins in one click; anyone else gives their name and email first.
 */
export function WaitlistButton({
  type,
  classId,
  eventId,
  title,
  entry,
  onChange,
  size = "sm",
}: {
  type: "class" | "workshop" | "event";
  classId?: string;
  eventId?: string;
  title: string;
  entry?: MyWaitlistEntry;
  onChange?: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ position: number } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, classId, eventId, name, email, phone }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't join the waitlist");
      setDone({ position: j.data.position });
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the waitlist");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setOpen(true);
    setDone(null);
    setError(null);
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setSignedIn(Boolean(me?.data));
    if (me?.data) void join();
  }

  async function leave() {
    if (!entry) return;
    setBusy(true);
    await fetch(`/api/waitlist?id=${entry.id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    onChange?.();
  }

  if (entry?.status === "offered") {
    return <Badge tone="success">🎟️ Seat held for you — book now</Badge>;
  }
  if (entry) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="info">⏳ On the waitlist</Badge>
        <button type="button" className="text-[11px] font-semibold text-copy-dim underline" onClick={leave} disabled={busy}>
          Leave
        </button>
      </div>
    );
  }

  return (
    <>
      <Button variant="secondary" size={size} onClick={start}>
        + Join Waitlist
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={done ? "You're on the waitlist 🎟️" : "Join the waitlist"}
        description={title}
        footer={
          done || signedIn ? (
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={join} disabled={busy || !name.trim() || !email.trim()}>
                {busy ? "Joining…" : "Join Waitlist"}
              </Button>
            </div>
          )
        }
      >
        {done ? (
          <div className="text-sm leading-6 text-copy">
            You&apos;re <strong>#{done.position}</strong> in line. As soon as a seat opens up we&apos;ll email you, and
            hold the seat for you for 24 hours.
          </div>
        ) : signedIn === null || (signedIn && busy) ? (
          <div className="text-sm text-copy-dim">Adding you to the waitlist…</div>
        ) : signedIn && error ? (
          <div className="text-sm font-semibold text-danger">{error}</div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-copy-dim">It&apos;s full right now. Leave your details and we&apos;ll email you when a seat opens up.</p>
            <Input placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {error && <div className="text-sm font-semibold text-danger">{error}</div>}
          </div>
        )}
      </Modal>
    </>
  );
}
