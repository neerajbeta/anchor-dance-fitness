"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { Avatar } from "@/components/ui";
import { STUDIO_PURPOSES } from "@/lib/data";

const RATE = 600; // SEK per hour — same rate as the user-facing studio booking

// Full 24h, 30-min steps: 00:00 → 23:30
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

type Student = { id: string; name: string; email: string; flag: string | null };
type Loc = { id: string; label: string; flag: string | null };

export function BookStudioOnBehalfButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; amount: number; discountCode?: string | null } | null>(null);

  // Student
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Booking
  const [locs, setLocs] = useState<Loc[]>([]);
  const [location, setLocation] = useState("Stockholm");

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocs(j.data ?? []));
  }, []);
  const [date, setDate] = useState("");
  const [startT, setStartT] = useState("");
  const [hours, setHours] = useState(1);
  const [purpose, setPurpose] = useState("");

  // Discount
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    type: "percent" | "flat";
    percent: number;
    flatAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // TIME_SLOTS is in 30-min steps, so 1 hour = 2 slots.
  const endT = startT
    ? TIME_SLOTS[(TIME_SLOTS.indexOf(startT) + hours * 2) % TIME_SLOTS.length] ?? "—"
    : "";
  const baseAmount = hours * RATE;
  const discountAmount = applied
    ? applied.type === "flat"
      ? Math.min(baseAmount, applied.flatAmount)
      : Math.round((baseAmount * applied.percent) / 100)
    : 0;
  const totalAmount = baseAmount - discountAmount;

  const studentName = selected ? selected.name : newName;
  const studentEmail = selected ? selected.email : newEmail;
  const ready = studentName.trim() && studentEmail.trim() && date && startT && purpose;

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setError(null);
  }, [open]);

  async function runSearch() {
    const res = await fetch(`/api/students?q=${encodeURIComponent(q)}`);
    const j = await res.json();
    setResults(j.data ?? []);
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Invalid code");
      setApplied(j.data);
    } catch (err) {
      setApplied(null);
      setCouponError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: studentName,
          email: studentEmail,
          location,
          flag: locs.find((l) => l.label === location)?.flag ?? "",
          type: "studio",
          detail: `${date} · ${startT}–${endT} · ${purpose}`,
          period: date,
          plan: "Studio Hire",
          paid: "paid",
          status: "Confirmed",
          statusTone: "ok",
          baseAmount,
          discountCode: applied ? coupon : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setDone({ id: j.data.id, amount: j.data.amount, discountCode: j.data.discountCode });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSelected(null);
    setNewName("");
    setNewEmail("");
    setQ("");
    setResults([]);
    setDate("");
    setStartT("");
    setHours(1);
    setPurpose("");
    setCoupon("");
    setApplied(null);
    setCouponError(null);
    setDone(null);
    setError(null);
  }

  return (
    <>
      <button
        className="btn btn-ink"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        + Book Studio on Behalf
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="py-4 text-center">
                <div className="text-4xl">✅</div>
                <div className="mt-2 font-display text-lg font-bold text-ink">Studio booking created</div>
                <p className="mt-1 text-[13px] text-slate">
                  Registration <span className="font-bold text-brand-600">{done.id}</span> for {studentName}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-cream/60 px-4 py-2">
                  <span className="text-[13px] text-muted">Amount charged</span>
                  <span className="font-bold text-ink">SEK {done.amount.toLocaleString()}</span>
                  {done.discountCode && <span className="badge badge-ok">🏷️ {done.discountCode}</span>}
                </div>
                <div className="mt-5 flex justify-center gap-2">
                  <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={reset}>
                    Book another
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-1 font-display text-lg font-bold text-ink">Book Studio on Behalf</div>
                <p className="mb-4 text-[13px] text-slate">
                  Register a studio hire for a student. Saved directly to the database.
                </p>

                {/* Student */}
                <div className="mb-3">
                  <label className="field-label">Search Existing Student</label>
                  <div className="flex gap-2">
                    <input
                      className="field flex-1"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                      placeholder="Name or email…"
                    />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={runSearch}>
                      Search
                    </button>
                  </div>
                  {results.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-lg border-[1.5px] border-line">
                      {results.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected(s)}
                          className={`flex w-full items-center gap-2.5 border-b border-line px-3 py-2 text-left last:border-b-0 ${
                            selected?.id === s.id ? "bg-brand-50" : "hover:bg-cream/50"
                          }`}
                        >
                          <Avatar letter={(s.name[0] || "?").toUpperCase()} size={22} />
                          <div className="flex-1 text-[12px]">
                            <div className="font-bold text-ink">{s.name}</div>
                            <div className="text-muted">{s.email}</div>
                          </div>
                          {selected?.id === s.id && <span className="badge badge-ok text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selected ? (
                  <div className="mb-3 flex items-center justify-between rounded-lg border-2 border-brand-500 p-3">
                    <div className="text-[13px]">
                      <div className="font-bold text-ink">{selected.name}</div>
                      <div className="text-muted">{selected.email}</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Full Name *</label>
                      <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Student name" />
                    </div>
                    <div>
                      <label className="field-label">Email *</label>
                      <input
                        className="field"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="student@example.com"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="field-label">Location *</label>
                  <LocationSelect value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>

                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="field-label">Date *</label>
                    <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Start Time *</label>
                    <select className="field" value={startT} onChange={(e) => setStartT(e.target.value)}>
                      <option value="" disabled>
                        Select
                      </option>
                      {TIME_SLOTS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Hours *</label>
                    <select className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((h) => (
                        <option key={h} value={h}>
                          {h} Hour{h > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {startT && (
                  <div className="mb-3 text-[11px] text-muted">
                    {date || "Date TBD"} · {startT}–{endT}
                  </div>
                )}

                <div className="mb-3">
                  <label className="field-label">Purpose *</label>
                  <select className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option value="">— Select purpose —</option>
                    {STUDIO_PURPOSES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Coupon */}
                <div className="mb-3">
                  <label className="field-label">Coupon (optional)</label>
                  <div className="flex gap-2">
                    <input
                      className="field uppercase"
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value);
                        setApplied(null);
                        setCouponError(null);
                      }}
                      placeholder="e.g. SUMMER20"
                    />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={applyCoupon} disabled={checking}>
                      {checking ? "…" : "Apply"}
                    </button>
                  </div>
                  {applied && (
                    <div className="mt-1.5 text-[12px] font-semibold text-ok">
                      ✓ {applied.code} applied — {applied.type === "flat" ? `SEK ${applied.flatAmount} off` : `${applied.percent}% off`}
                    </div>
                  )}
                  {couponError && <div className="mt-1.5 text-[12px] font-semibold text-danger">{couponError}</div>}
                </div>

                {/* Order summary */}
                <div className="mb-3 rounded-lg border-[1.5px] border-line bg-cream/60 p-4">
                  <div className="flex justify-between py-1 text-[13px]">
                    <span className="text-muted">
                      Studio Hire — {hours} Hour{hours > 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-ink">SEK {baseAmount.toLocaleString()}</span>
                  </div>
                  {applied && (
                    <div className="flex justify-between py-1 text-[13px] text-ok">
                      <span>
                        Discount ({applied.code} · {applied.type === "flat" ? `SEK ${applied.flatAmount}` : `${applied.percent}%`})
                      </span>
                      <span>− SEK {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 text-sm font-bold">
                    <span>Total</span>
                    <span className="text-brand-600">SEK {totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {error && (
                  <div className="mb-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                    {error}
                  </div>
                )}

                <div className="flex justify-between">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ink ${ready && !busy ? "" : "is-disabled"}`}
                    onClick={submit}
                  >
                    {busy ? "Booking…" : `✓ Confirm Booking — SEK ${totalAmount.toLocaleString()}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
