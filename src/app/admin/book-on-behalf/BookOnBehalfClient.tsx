"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Avatar, SectionHead, toneClass } from "@/components/ui";
import { CATEGORIES, LEVELS as LEVELS_FALLBACK, type Registration } from "@/lib/data";
import { INTERVAL_MONTHS, isTrialPlan, planTotal, sortPlans, trialPlanOf, type Plan } from "@/lib/plans";
import { DatePicker } from "@/components/theme/DatePicker";
import { useVatPrice } from "@/components/payments/Vat";
import { formatVatRate } from "@/lib/vat";

type Student = {
  id: string;
  name: string;
  email: string;
  location: string | null;
  flag: string | null;
  age: number | null;
  phone?: string | null;
  customerStatus?: string;
  blacklisted?: boolean;
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
  seats?: { capacity: number; left: number | null; full: boolean } | null;
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

  // "Trial class" books the demo plan for a single session; the price starts at
  // the studio's trial price and can be changed for this booking only.
  const [isTrial, setIsTrial] = useState(false);
  const [trialPrice, setTrialPrice] = useState("");

  // Swish: the customer's own mobile number, which is where the payment request
  // lands. `swishAlias` is the studio's number the money is collected to.
  const [swishPhone, setSwishPhone] = useState("");
  const [swishAlias, setSwishAlias] = useState<string | null>(null);
  const [swishReady, setSwishReady] = useState<boolean | null>(null);
  /** Set once a request is out, so the admin can watch it being approved. */
  const [swishWatch, setSwishWatch] = useState<
    { id: string; phone: string; payeeAlias: string; amount: number; state: "waiting" | "paid" | "failed" } | null
  >(null);

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
    // Can this site actually send a Swish request, and from which number?
    fetch("/api/payments/methods")
      .then((r) => r.json())
      .then((j) => {
        setSwishReady(Boolean(j.data?.swish));
        setSwishAlias(j.data?.swishPayeeAlias ?? null);
      })
      .catch(() => setSwishReady(false));
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

  const trialPlan = trialPlanOf(planList);
  const selectedPlan = planList.find((p) => p.code === form.plan) ?? null;
  const months = selectedPlan ? INTERVAL_MONTHS[selectedPlan.interval] : 0;
  // Same rule as the student Choose Plan screen: class price × plan months
  // (demo / one-time plans charge the plan price once).
  const planAmount = selectedPlan ? planTotal(selectedPlan, selectedClass?.price) : selectedClass?.price ?? 0;
  // A trial is charged at the trial price, which the admin can override for
  // this one booking (a free taster, a corporate rate) without touching the
  // trial price the studio normally charges.
  const trialPriceNum = Number(trialPrice);
  const baseAmount =
    isTrial && trialPrice.trim() !== "" && Number.isFinite(trialPriceNum) && trialPriceNum >= 0
      ? Math.round(trialPriceNum)
      : planAmount;
  const discountAmount = applied
    ? applied.type === "flat"
      ? Math.min(baseAmount, applied.flatAmount)
      : Math.round((baseAmount * applied.percent) / 100)
    : 0;
  // VAT per the VAT master — the same total the server records.
  const vat = useVatPrice("class", baseAmount - discountAmount);
  const totalAmount = vat.total;

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

  // Opened from Customers / Trial Sessions: pick that student straight away
  // (or start a new profile with their name + email), and for a trial request
  // pre-select the Demo plan.
  const [wantTrialPlan, setWantTrialPlan] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email")?.trim().toLowerCase();
    const name = params.get("name")?.trim() ?? "";
    if (params.get("trial") === "1") setWantTrialPlan(true);
    if (!email) return;
    setQ(email);
    fetch(`/api/students?q=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((j) => {
        const list: Student[] = j.data ?? [];
        setResults(list);
        const match = list.find((s) => s.email.toLowerCase() === email);
        if (match) setSelected(match);
        else {
          setNewMode(true);
          setForm((f) => ({ ...f, name: f.name || name, email }));
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!wantTrialPlan || !planList.length) return;
    if (trialPlanOf(planList)) setIsTrial(true);
    setWantTrialPlan(false);
  }, [wantTrialPlan, planList]);

  /**
   * Switching to a trial picks the trial plan, prefills its price and books a
   * single session (end date = start date). Switching back restores a normal
   * plan and leaves the dates for the admin to set.
   */
  // While a Swish request is open, ask our server (which asks Swish) how it
  // went, so the admin sees it approved without refreshing the page.
  useEffect(() => {
    if (swishWatch?.state !== "waiting") return;
    const id = swishWatch.id;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/verify?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const j = await res.json();
        if (stopped || !res.ok) return;
        if (j.data?.state === "paid") setSwishWatch((w) => (w ? { ...w, state: "paid" } : w));
        else if (j.data?.state === "failed") setSwishWatch((w) => (w ? { ...w, state: "failed" } : w));
      } catch {
        /* transient — the next tick retries */
      }
    }, 3000);
    // Swish requests expire after a few minutes; stop asking then.
    const giveUp = setTimeout(() => {
      stopped = true;
      clearInterval(timer);
    }, 5 * 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(giveUp);
    };
  }, [swishWatch?.state, swishWatch?.id]);

  // The student's own number is the usual Swish number — prefill it, but let
  // the admin change it (a parent paying for a child, a different phone).
  useEffect(() => {
    if (selected?.phone && !swishPhone) setSwishPhone(selected.phone);
  }, [selected, swishPhone]);

  function setTrialMode(on: boolean) {
    setIsTrial(on);
    setApplied(null);
    setCoupon("");
    if (on) {
      const demo = trialPlanOf(planList);
      setTrialPrice(String(demo?.price ?? ""));
      setForm((f) => ({ ...f, plan: demo?.code ?? f.plan, end: f.start || f.end }));
    } else {
      setTrialPrice("");
      const normal = planList.find((p) => p.interval === "quarterly") ?? planList.find((p) => !isTrialPlan(p));
      if (normal) setForm((f) => ({ ...f, plan: normal.code }));
    }
  }

  // A trial is one session — keep the end date on the start date.
  useEffect(() => {
    if (isTrial && form.start && form.end !== form.start) setForm((f) => ({ ...f, end: f.start }));
  }, [isTrial, form.start, form.end]);

  const studentName = selected ? selected.name : form.name;
  const studentEmail = selected ? selected.email : form.email;
  const ready = studentName.trim() && studentEmail.trim();

  async function submit() {
    if (form.payment === "swish" && !swishPhone.trim()) {
      setError("Enter the customer's Swish number — that's where the payment request is sent.");
      return;
    }
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
      // A trial is a single session, so it's recorded on its own date — that's
      // also the date the Trial Sessions report follows up on.
      period: isTrial ? form.start : `${form.start} – ${form.end}`,
      plan: selectedPlan?.name ?? form.plan,
      // Swish is unpaid until the customer approves it on their phone.
      paid:
        form.payment === "waived"
          ? "onetime"
          : form.payment === "link" || form.payment === "swish"
          ? "pending"
          : "paid",
      // The server marks the booking as "paying by Swish" only once Swish has
      // actually accepted the request.
      swishPhone: form.payment === "swish" ? swishPhone.trim() : undefined,
      status: isTrial ? "Trial Booked" : "Pending Batch",
      statusTone: "warn",
      baseAmount,
      discountCode: applied ? coupon : undefined,
      classId: classId || undefined,
    };
    try {
      const post = (body: object) =>
        fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      let res = await post(payload);
      let j = await res.json();
      // Full class: book over capacity only if the admin confirms.
      if (res.status === 409 && j.full) {
        if (!confirm(`${selectedClass?.name ?? "This class"} is full — every seat is booked.\n\nBook this student anyway (over capacity)?`)) {
          throw new Error("Not booked — the class is full. Add them to the waitlist from Batch Capacity instead.");
        }
        res = await post({ ...payload, overbook: true });
        j = await res.json();
      }
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setDone({ id: j.data.id, amount: j.data.amount, discountCode: j.data.discountCode });
      if (j.swish) {
        setSwishWatch({
          id: j.data.id,
          phone: swishPhone.trim(),
          payeeAlias: j.swish.payeeAlias,
          amount: j.swish.amount,
          state: "waiting",
        });
      } else if (j.swishError) {
        // The booking exists; only the request failed — say which is which.
        setError(`Booking ${j.data.id} was saved as unpaid — ${j.swishError}`);
      }
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
    setError(null);
    setSwishWatch(null);
    setSwishPhone("");
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

          {swishWatch && (
            <div
              className={`mt-4 rounded-lg border-[1.5px] p-4 text-left ${
                swishWatch.state === "paid"
                  ? "border-ok/40 bg-ok/5"
                  : swishWatch.state === "failed"
                  ? "border-danger/40 bg-danger/5"
                  : "border-line bg-cream/60"
              }`}
            >
              <div className="text-[13px] font-bold text-ink">
                {swishWatch.state === "paid"
                  ? "✅ Paid with Swish"
                  : swishWatch.state === "failed"
                  ? "❌ The customer declined or the request expired"
                  : "📲 Swish request sent — waiting for the customer"}
              </div>
              <div className="mt-1 text-[12px] text-slate">
                SEK {swishWatch.amount.toLocaleString()} requested from <strong>{swishWatch.phone}</strong>, collected
                to the studio&apos;s Swish number <strong>{swishWatch.payeeAlias}</strong>.
              </div>
              {swishWatch.state === "waiting" && (
                <div className="mt-1 text-[11px] text-muted">
                  They approve it in their Swish app. This updates on its own; the booking stays unpaid until then, and
                  you can also check it later under All Registrations.
                </div>
              )}
              {swishWatch.state === "failed" && (
                <div className="mt-1 text-[11px] text-muted">
                  The booking is saved as unpaid — take payment another way, or send a new request from All
                  Registrations.
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-left text-xs font-semibold text-danger">
              {error}
            </div>
          )}

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
                    {s.blacklisted && <span className="badge badge-danger">⛔ Blacklisted</span>}
                    {!s.blacklisted && s.customerStatus === "paused" && <span className="badge badge-warn">Paused</span>}
                    {!s.blacklisted && s.customerStatus === "dropped" && <span className="badge badge-gray">Dropped off</span>}
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
                    {selected.blacklisted ? (
                      <div className="mt-2 rounded-lg bg-danger/10 px-2.5 py-2 text-[12px] font-semibold text-danger">
                        ⛔ This customer is blacklisted — remove them from the blacklist in Customers before booking.
                      </div>
                    ) : selected.customerStatus === "paused" || selected.customerStatus === "dropped" ? (
                      <div className="mt-2 rounded-lg bg-warn/10 px-2.5 py-2 text-[12px] font-semibold text-ink">
                        {selected.customerStatus === "paused" ? "⏸️ Currently paused" : "📉 Currently dropped off"} — this
                        booking resumes them on their existing record, with all their history.
                      </div>
                    ) : null}
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
                      {c.seats && c.seats.capacity > 0
                        ? c.seats.full
                          ? " · FULL"
                          : ` · ${c.seats.left}/${c.seats.capacity} seats left`
                        : ""}
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
            {selectedClass?.seats?.full && (
              <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
                ⚠️ This class is full ({selectedClass.seats.capacity}/{selectedClass.seats.capacity} seats booked). You&apos;ll be
                asked to confirm before booking over capacity.
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

            {/* Regular term booking, or a single trial class. */}
            <div className="mt-3">
              <label className="field-label">Booking Type *</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BookingKind
                  active={!isTrial}
                  onClick={() => setTrialMode(false)}
                  icon="📚"
                  title="Regular booking"
                  sub="A term on a membership plan."
                />
                <BookingKind
                  active={isTrial}
                  onClick={() => setTrialMode(true)}
                  disabled={!trialPlan}
                  icon="🎟️"
                  title="Trial class"
                  sub={
                    trialPlan
                      ? `One session at the trial price (SEK ${trialPlan.price.toLocaleString()}).`
                      : "Add a plan with the Demo / trial interval under Catalog → Plans first."
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">{isTrial ? "Trial Date *" : "Start Date *"}</label>
                <DatePicker variant="admin" value={form.start} onChange={(v) => set("start", v)} placeholder="Select start date" />
              </div>
              {isTrial ? (
                <div>
                  <label className="field-label">Trial Price (SEK) *</label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={trialPrice}
                    onChange={(e) => setTrialPrice(e.target.value)}
                    placeholder={String(trialPlan?.price ?? 0)}
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Starts at the studio&apos;s trial price. Change it for this booking only — 0 makes the trial free.
                    The default lives in Catalog → Plans.
                  </p>
                </div>
              ) : (
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
              )}
            </div>

            <div className={`mt-3 ${isTrial ? "hidden" : ""}`}>
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
                <option value="swish" disabled={swishReady === false}>
                  Swish — send a request to the customer&apos;s phone
                  {swishReady === false ? " (not set up)" : ""}
                </option>
                <option value="card">Charge saved card on file</option>
                <option value="link">Send payment link to student</option>
                <option value="waived">Mark as complimentary / waived</option>
              </select>
            </div>

            {form.payment === "swish" && (
              <div className="mt-3 rounded-lg border-[1.5px] border-line bg-cream/50 p-3.5">
                <label className="field-label">Customer&apos;s Swish Number *</label>
                <input
                  className="field"
                  type="tel"
                  inputMode="tel"
                  value={swishPhone}
                  onChange={(e) => setSwishPhone(e.target.value)}
                  placeholder="070 123 45 67"
                />
                <p className="mt-1 text-[11px] text-muted">
                  The Swedish mobile the customer&apos;s Swish is connected to — the payment request pops up on that
                  phone and they approve it there. Nothing is charged until they do.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate">
                  <span className="font-semibold text-ink">Collected to:</span>
                  {swishAlias ? (
                    <span className="badge badge-brand">Swish {swishAlias}</span>
                  ) : (
                    <span className="font-semibold text-danger">
                      No merchant number set — add SWISH_PAYEE_ALIAS before taking Swish payments.
                    </span>
                  )}
                  <span>· the studio&apos;s own Swish number, shown to the customer when they approve.</span>
                </div>
                {swishReady === false && (
                  <div className="mt-2 text-[11px] font-semibold text-danger">
                    Swish isn&apos;t ready on this site — upload the merchant certificate in Portal Settings first.
                  </div>
                )}
              </div>
            )}

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
                k={
                  isTrial
                    ? `${selectedClass ? `${selectedClass.name} · ` : ""}Trial class${
                        form.start ? ` on ${form.start}` : ""
                      }`
                    : `${selectedClass ? `${selectedClass.name} · ` : ""}${selectedPlan?.name ?? "Plan"}${
                        selectedPlan && months > 0
                          ? ` (SEK ${(selectedClass?.price || selectedPlan.price).toLocaleString()} × ${months} mo)`
                          : ""
                      }`
                }
                v={`SEK ${baseAmount.toLocaleString()}`}
              />
              {isTrial && trialPlan && baseAmount !== trialPlan.price && (
                <div className="py-0.5 text-[11px] font-semibold text-brand-600">
                  Custom price for this booking — the studio&apos;s trial price is SEK{" "}
                  {trialPlan.price.toLocaleString()}.
                </div>
              )}
              {applied && (
                <Row k={`Discount (${applied.code} · ${applied.type === "flat" ? `SEK ${applied.flatAmount}` : `${applied.percent}%`})`} v={`− SEK ${discountAmount.toLocaleString()}`} accent />
              )}
{vat.mode ? (
                <div className="flex justify-between py-1 text-[13px]">
                  <span className="text-muted">
                    {vat.mode === "exclusive" ? "VAT" : "Includes VAT"} ({formatVatRate(vat.rateBp)})
                  </span>
                  <span className="font-semibold text-ink">
                    {vat.mode === "exclusive" ? "+ " : ""}SEK {vat.vat.toLocaleString()}
                  </span>
                </div>
              ) : null}
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

/** One of the two booking kinds — a regular term, or a single trial class. */
function BookingKind({
  active,
  onClick,
  disabled,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-2.5 rounded-lg border-[1.5px] p-3 text-left transition ${
        disabled
          ? "cursor-not-allowed border-line bg-cream/40 opacity-60"
          : active
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
          : "border-line bg-white hover:border-brand-300"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>
        <span className="block text-[13px] font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{sub}</span>
      </span>
    </button>
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
