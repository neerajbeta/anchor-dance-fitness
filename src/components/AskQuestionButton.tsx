"use client";

import { useState } from "react";
import { Button } from "@/components/theme/Button";
import { Input, Textarea } from "@/components/theme/Input";
import { Modal } from "@/components/theme/Modal";

/**
 * "Ask a question" about a workshop / event. Lands in Admin → Enquiries for
 * follow-up, credited to the promotion link the visitor came through.
 */
export function AskQuestionButton({ eventId, title }: { eventId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", question: "" });
  const [consent, setConsent] = useState(false);

  async function start() {
    setOpen(true);
    setDone(false);
    setError(null);
    // Prefill for signed-in students.
    const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (me?.data) setForm((f) => ({ ...f, fullName: f.fullName || me.data.name, email: f.email || me.data.email }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "workshop",
          eventId,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          areaOfInterest: title,
          additionalInfo: form.question,
          consent,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't send your question");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your question");
    } finally {
      setBusy(false);
    }
  }

  const ready = form.fullName.trim() && form.email.trim() && form.phone.trim() && consent;

  return (
    <>
      <button type="button" onClick={start} className="text-[12px] font-semibold text-copy-dim underline-offset-2 hover:text-accent hover:underline">
        💬 Ask a question
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={done ? "Thanks — we got your question" : "Ask about this"}
        description={title}
        footer={
          done ? (
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || !ready}>
                {busy ? "Sending…" : "Send question"}
              </Button>
            </div>
          )
        }
      >
        {done ? (
          <p className="text-sm leading-6 text-copy">Our team will get back to you shortly by email or phone. 💃</p>
        ) : (
          <div className="grid gap-3">
            <Input placeholder="Full name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Textarea
              placeholder="Your question — e.g. Is it suitable for beginners? Can I bring a friend?"
              rows={3}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            <label className="flex items-start gap-2 text-[12px] text-copy-dim">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I agree that Anchor Dance &amp; Fitness may contact me about this question and store my details for that
              purpose (GDPR).
            </label>
            {error && <div className="text-sm font-semibold text-danger">{error}</div>}
          </div>
        )}
      </Modal>
    </>
  );
}
