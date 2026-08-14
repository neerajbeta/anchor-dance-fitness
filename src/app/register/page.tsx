"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoWordmark } from "@/components/Logo";
import { Stepper } from "@/components/Stepper";

export default function RegisterPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          dob: fd.get("dob"),
          gender: fd.get("gender"),
          phone: fd.get("phone"),
          city: fd.get("city"),
          country: fd.get("country"),
          email: fd.get("email"),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Registration failed");
      router.push("/book/class");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Step 1 of 3 — Profile Setup</div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8 anim-fade">
        <Stepper steps={["Your Details", "Choose Plan", "Payment"]} current={0} />

        <form className="card" onSubmit={submit}>
          <div className="card-title">Tell us about yourself</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="name" label="Full Name *" placeholder="e.g. Priya Sharma" required />
            <Field name="dob" label="Date of Birth *" type="date" required />
            <div>
              <label className="field-label">Gender *</label>
              <select name="gender" className="field" required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <Field name="phone" label="Contact Number *" type="tel" placeholder="+46 70 000 0000" required />
            <Field name="city" label="City *" placeholder="e.g. Stockholm" required />
            <div>
              <label className="field-label">Country *</label>
              <select name="country" className="field" required defaultValue="Sweden">
                <option>Sweden</option>
                <option>India</option>
                <option>United Kingdom</option>
                <option>United States</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="field-label">Email Address *</label>
            <input name="email" className="field" type="email" placeholder="you@example.com" required />
          </div>

          {error && (
            <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-danger">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Link href="/login" className="btn btn-ghost">
              ← Back
            </Link>
            <button type="submit" className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>
              {busy ? "Saving…" : "Save & Continue →"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input name={name} className="field" type={type} placeholder={placeholder} required={required} />
    </div>
  );
}
