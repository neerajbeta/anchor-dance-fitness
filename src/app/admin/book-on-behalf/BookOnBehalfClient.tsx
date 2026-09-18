"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { CATEGORIES, LEVELS as LEVELS_FALLBACK, type Registration } from "@/lib/data";
import { INTERVAL_MONTHS, planTotal, sortPlans, type Plan } from "@/lib/plans";
import { DatePicker } from "@/components/theme/DatePicker";

type Student = {
  id: string;
  name: string;
  email: string;
  location: string | null;
  flag: string | null;
  age: number | null;
};
type Location = { id: string; label: string; flag: string | null };
type ClassRow = {
  id: string;
  name: string;
  category: string;
  level: string;
  location: string;
  mode: "online" | "offline";
  days: string | null;
  startTime: string;
  endTime: string;
  coach: string | null;
  price: number;
};
const fmt = (t?: string) => (t ? t.slice(0, 5) : "");

export function BookOnBehalfClient({
  rows,
  connected,
}: {
  rows: Registration[];
  connected: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [newMode, setNewMode] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mode: "online" as "online" | "offline",
    location: "", // defaults to the first location from the Locations table
    category: "Bollywood Dance",
    level: "Beginner",
    age: "",
    start: "",
    end: "",
    plan: "",
    payment: "external",
  });

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; amount: number; discountCode?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [categoryList, setCategoryList] = useState<{ id: string; name: string }[]>([]);
  const [levelList, setLevelList] = useState<{ id: string; name: string }[]>([]);
  const [planList, setPlanList] = useState<Plan[]>([]);
  const [classId, setClassId] = useState("");

  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    type: "percent" | "flat";
    percent: number;
    flatAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => {
        const list: Location[] = j.data ?? [];
        setLocations(list);
        setForm((f) => ({ ...f, location: f.location || list[0]?.label || "" }));
      });
    fetch("/api/classes").then((r) => r.json()).then((j) => setClasses(j.data ?? []));
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategoryList(j.data ?? []));
    fetch("/api/levels").then((r) => r.json()).then((j) => setLevelList(j.data ?? []));
    fetch("/api/plans")
      .then((r) => r.json())
      .then((j) => {
        const list = sortPlans((j.data ?? []) as Plan[]);
        setPlanList(list);
        const fallback = (list.find((p) => p.interval === "quarterly") ?? list[0])?.code ?? "";
        setForm((f) => ({ ...f, plan: list.some((p) => p.code === f.plan) ? f.plan : fallback }));
      });
    // Default period: today → 3 months (set on the client to avoid an SSR date mismatch).
    const today = new Date();
    const later = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setForm((f) => ({ ...f, start: f.start || iso(today), end: f.end || iso(later) }));
  }, []);

  const available = useMemo(
    () =>
      classes.filter(
        // Same rule as the student Book a Class page: both modes filter by studio location.
        (c) => c.mode === form.mode && (!form.location || c.location === form.location)
      ),
    [classes, form.mode, form.location]
  );
  const selectedClass = available.find((c) => c.id === classId) || null;

  function pickClass(id: string) {
    setClassId(id);
    const c = available.find((x) => x.id === id);
    if (c) setForm((f) => ({ ...f, category: c.category, level: c.level }));
  }

  const selectedPlan = planList.find((p) => p.code === form.plan) ?? null;
  const months = selectedPlan ? INTERVAL_MONTHS[selectedPlan.interval] : 0;
  // Same rule as the student Choose Plan screen: class price × plan months
  // (demo / one-time plans charge the plan price once).
  const baseAmount = selectedPlan ? planTotal(selectedPlan, selectedClass?.price) : selectedClass?.price ?? 0;
  const discountAmount = applied
    ? applied.type === "flat"
      ? Math.min(baseAmount, applied.flatAmount)
      : Math.round((baseAmount * applied.percent) / 100)
    : 0;
  const totalAmount = baseAmount - discountAmount;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setChecking(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/discounts/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon, category: form.category, classId: classId || undefined }),
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

  async function runSearch() {
    setSearching(true);
    try {
      const res = await fetch(`/api/students?q=${encodeURIComponent(q)}`);
      const j = await res.json();
      setResults(j.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const studentName = selected ? selected.name : form.name;
  const studentEmail = selected ? selected.email : form.email;
  const ready = studentName.trim() && studentEmail.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    const loc = locations.find((l) => l.label === form.location);
    const payload = {
      name: studentName,
      email: studentEmail,
      age: form.age ? Number(form.age) : null,
      location: form.location,
      flag: loc?.flag ?? "",
      type: "class",
      detail: selectedClass
        ? `${selectedClass.name} · ${fmt(selectedClass.startTime)}–${fmt(selectedClass.endTime)}`
        : "Batch TBD",
      category: form.category,
      level: form.level,
      mode: form.mode,
      period: `${form.start} – ${form.end}`,
      plan: selectedPlan?.name ?? form.plan,
      paid: form.payment === "waived" ? "onetime" : form.payment === "link" ? "pending" : "paid",
      status: "Pending Batch",
      statusTone: "warn",
      baseAmount,
      discountCode: applied ? coupon : undefined,
      classId: classId || undefined,
    };
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setDone({ id: j.data.id, amount: j.data.amount, discountCode: j.data.discountCode });
      router.refresh(); // refreshes the Recent Bookings list below
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() {
    setDone(null);
    setSelected(null);
    setNewMode(false);
    setCoupon("");
    setApplied(null);
    setCouponError(null);
    setForm((f) => ({ ...f, name: "", email: "", age: "" }));
  }

  return (
    <AdminShell>
      <SectionHead
        title="Book on Behalf of a User"
        sub="Register a student for a class on their behalf. Saved directly to the database."
        right={
          connected ? (
            <span className="badge badge-ok" title="Reading from PostgreSQL">
              ● Live database
            </span>
          ) : (
            <span className="badge badge-warn">● Sample data</span>
          )
        }
      />

      {done ? (
        <div className="mx-auto mb-6 max-w-lg rounded-xl border-[1.5px] border-ok/40 bg-ok/5 p-8 text-center shadow-card">
          <div className="text-4xl">✅</div>
          <div className="mt-2 font-display text-xl font-bold text-ink">Booking created</div>
          <p className="mt-1 text-[13px] text-slate">
            Registration <span className="font-bold text-brand-600">{done.id}</span> for {studentName} has been
            saved to the database.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-cream/60 px-4 py-2">
            <span className="text-[13px] text-muted">Amount charged</span>
            <span className="font-bold text-ink">SEK {done.amount.toLocaleString()}</span>
            {done.discountCode && <span className="badge badge-ok">🏷️ {done.discountCode}</span>}
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/admin/registrations" className="btn btn-primary">
              View in All Registrations →
            </Link>
            <button className="btn btn-ghost" onClick={resetForm}>
              Book another
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: student selector */}
          <div className="card">
            <div className="card-title">👤 Select Student</div>
            <div className="mb-3 flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2">
                <span>🔍</span>
                <input
                  className="flex-1 border-none bg-transparent text-[13px] outline-none"
                  placeholder="Search existing users by name or email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={runSearch}>
                {searching ? "…" : "Search"}
              </button>
            </div>

            {results.length > 0 && (
              <div className="mb-3 overflow-hidden rounded-lg border-[1.5px] border-line">
                {results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelected(s);
                      setNewMode(false);
                    }}
                    className={`flex w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-b-0 ${
                      selected?.id === s.id ? "bg-brand-50" : "hover:bg-cream/50"
                    }`}
                  >
                    <Avatar letter={(s.name[0] || "?").toUpperCase()} size={26} />
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-ink">{s.name}</div>
                      <div className="text-[11px] text-muted">
                        {s.email} {s.flag ? `· ${s.flag}` : ""}
                      </div>
                    </div>
                    {selected?.id === s.id && <span className="badge badge-ok">Selected ✓</span>}
                  </button>
                ))}
              </div>
            )}
            {results.length === 0 && q && !searching && (
              <div className="mb-3 rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 px-3 py-2 text-[12px] text-muted">
                No existing students match "{q}". Add a new one below.
              </div>
            )}

            <hr className="my-3 border-line" />
            {!newMode && !selected && (
              <button className="btn btn-ghost btn-sm btn-block" onClick={() => setNewMode(true)}>
                + Create New Student Profile
              </button>
            )}

            {(newMode || selected) && (
              <div className="rounded-lg border-2 border-brand-500 p-4">
                <div className="card-title text-brand-600">
                  {selected ? "✓ Booking for existing student" : "New student"}
                </div>
                {selected ? (
                  <div className="text-[13px]">
                    <div className="font-bold text-ink">{selected.name}</div>
                    <div className="text-muted">{selected.email}</div>
                    <button className="btn btn-ghost btn-sm mt-2" onClick={() => setSelected(null)}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="field-label">Full Name *</label>
                      <input
                        className="field"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. Priya Sharma"
                      />
                    </div>
                    <div>
                      <label className="field-label">Email *</label>
                      <input
                        className="field"
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="student@example.com"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Class Bookings — reads from registrations, live */}
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate">
                Recent Class Bookings
              </div>
              {rows.length === 0 ? (
                <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 px-3 py-4 text-center text-[12px] text-muted">
                  No class bookings yet.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {rows.slice(0, 8).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar letter={r.initial} color={r.color} size={22} />
                        <div className="text-[12px]">
                          <div className="font-bold text-ink">{r.name}</div>
                          <div className="text-muted">
                            {r.category ?? "—"} · {r.location}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[11px] font-semibold text-ink">
                          SEK {(r.amount ?? 0).toLocaleString()}
                        </span>
                        <span className={`badge ${toneClass[r.statusTone] ?? "badge-gray"} text-[9px]`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: booking form */}
          <div className="card">
            <div className="card-title">💃 Class Booking Details</div>

            <div className="mb-3">
              <label className="field-label">Mode of Class *</label>
              <div className="flex w-fit overflow-hidden rounded-lg border-2 border-line">
                {(["online", "offline"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => set("mode", m)}
                    className={`px-4 py-2 text-[13px] font-semibold ${
                      form.mode === m ? "bg-ink text-white" : "bg-white text-slate"
                    }`}
                  >
                    {m === "online" ? "💻 Online" : "🏃 In-Person"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="field-label">Studio Location *</label>
              <select
                className="field"
                value={form.location}
                onChange={(e) => {
                  set("location", e.target.value);
                  setClassId("");
                }}
              >
                {locations.length === 0 && <option value="">No locations — add one under Catalog → Locations</option>}
                {locations.map((l) => (
                  <option key={l.id} value={l.label}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Class selector — auto-fills category, level, and time */}
            <div className="mb-3">
              <label className="field-label">Select a Class *</label>
              {available.length > 0 ? (
                <select className="field" value={classId} onChange={(e) => pickClass(e.target.value)}>
                  <option value="">Choose an available class…</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.category} · {c.level}
                      {c.days ? ` · ${c.days}` : ""} · {fmt(c.startTime)}–{fmt(c.endTime)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 px-3 py-2.5 text-[12px] text-muted">
                  No classes for this mode/location yet. Add one under{" "}
                  <span className="font-semibold text-brand-600">Classes &amp; Locations</span>, or set
                  category/level manually below.
                </div>
              )}
            </div>

            {selectedClass && (
              <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border-[1.5px] border-brand-200 bg-brand-50 p-3.5 sm:grid-cols-4">
                <Auto label="Category" value={selectedClass.category} />
                <Auto label="Level" value={selectedClass.level} />
                <Auto
                  label="Class Time"
                  value={`${fmt(selectedClass.startTime)} – ${fmt(selectedClass.endTime)}`}
                  highlight
                />
                <Auto label="Coach" value={selectedClass.coach || "TBA"} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="field-label">Age</label>
                <input
                  className="field"
                  type="number"
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  placeholder="28"
                />
              </div>
              <div>
                <label className="field-label">Category *</label>
                <select className="field" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {(categoryList.length ? categoryList.map((c) => c.name) : CATEGORIES).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Level *</label>
                <select className="field" value={form.level} onChange={(e) => set("level", e.target.value)}>
                  {(levelList.length ? levelList.map((l) => l.name) : LEVELS_FALLBACK).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Start Date *</label>
                <DatePicker variant="admin" value={form.start} onChange={(v) => set("start", v)} placeholder="Select start date" />
              </div>
              <div>
                <label className="field-label">End Date *</label>
                <DatePicker
                  variant="admin"
                  value={form.end}
                  onChange={(v) => set("end", v)}
                  min={form.start || undefined}
                  initialMonth={form.start || undefined}
                  placeholder="Select end date"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="field-label">Plan *</label>
              <select className="field" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
                {planList.length === 0 && <option value="">No active plans — add one under Catalog → Plans</option>}
                {planList.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} — SEK {p.price.toLocaleString()}
                    {INTERVAL_MONTHS[p.interval] > 0 ? "/mo" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <label className="field-label">Payment Method *</label>
              <select className="field" value={form.payment} onChange={(e) => set("payment", e.target.value)}>
                <option value="external">Paid externally (cash / bank transfer)</option>
                <option value="card">Charge saved card on file</option>
                <option value="link">Send payment link to student</option>
                <option value="waived">Mark as complimentary / waived</option>
              </select>
            </div>

            {/* Coupon */}
            <div className="mt-3">
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
                <button className="btn btn-ghost btn-sm" onClick={applyCoupon} disabled={checking}>
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
            <div className="mt-3 rounded-lg border-[1.5px] border-line bg-cream/60 p-4">
              <Row
                k={`${selectedClass ? `${selectedClass.name} · ` : ""}${selectedPlan?.name ?? "Plan"}${
                  selectedPlan && months > 0
                    ? ` (SEK ${(selectedClass?.price || selectedPlan.price).toLocaleString()} × ${months} mo)`
                    : ""
                }`}
                v={`SEK ${baseAmount.toLocaleString()}`}
              />
              {applied && (
                <Row k={`Discount (${applied.code} · ${applied.type === "flat" ? `SEK ${applied.flatAmount}` : `${applied.percent}%`})`} v={`− SEK ${discountAmount.toLocaleString()}`} accent />
              )}
              <div className="flex justify-between pt-1.5 text-sm font-bold">
                <span>Total</span>
                <span className="text-brand-600">SEK {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </div>
            )}

            <button
              className={`btn btn-primary btn-lg btn-block mt-4 ${ready && !busy ? "" : "is-disabled"}`}
              onClick={submit}
            >
              {busy ? "Saving…" : "✓ Confirm Booking"}
            </button>
            {!ready && (
              <div className="mt-2 text-center text-[11px] text-muted">
                Select or add a student to enable booking.
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Auto({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-[13px] font-bold ${highlight ? "text-brand-600" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className={`font-semibold ${accent ? "text-ok" : "text-ink"}`}>{v}</span>
    </div>
  );
}
