"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Input, Select } from "@/components/theme/Input";
import { DatePicker } from "@/components/theme/DatePicker";
import { Button } from "@/components/theme/Button";
import { FormField } from "@/components/theme/form-field";
import { COUNTRIES } from "@/lib/countries";

export function RegisterForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [dob, setDob] = useState("");
  // Date of birth can't be in the future.
  const currentYear = new Date().getFullYear();
  const latestDob = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEmailTaken(false);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    const confirmPassword = String(fd.get("confirmPassword") || "");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
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
          password,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409) setEmailTaken(true);
      if (!res.ok) throw new Error(j.error || "Registration failed");
      // The response set the session cookie — the student is now signed in.
      // Full navigation (not router.push + refresh, which can cancel each
      // other) so Book a Class always opens with the new session.
      window.location.assign("/book/class");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <header className="premium-nav sticky top-0 z-30 flex h-[68px] items-center justify-between px-5 text-white">
        <BrandLogo variant="dark" size="sm" href="/" />
        <ThemeToggle tone="brand" />
      </header>

      <main className="animate-enter mx-auto w-full max-w-2xl px-4 py-10">
        <div className="mb-6 text-center">
          <h1 className="font-oswald text-3xl font-semibold italic text-copy">Create your account</h1>
          <p className="mt-1.5 text-sm text-copy-dim">
            Sign up once — you&apos;ll be signed in and taken straight to booking a class.
          </p>
        </div>

        <form className="surface-card p-6 md:p-7" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <FormField label="Full Name" required>
              <Input name="name" placeholder="e.g. Priya Sharma" required />
            </FormField>
            <FormField label="Date of Birth" required>
              <DatePicker
                name="dob"
                required
                value={dob}
                onChange={setDob}
                max={latestDob}
                yearRange={[currentYear - 100, currentYear]}
                initialMonth={`${currentYear - 25}-01-01`}
                placeholder="Select date of birth"
              />
            </FormField>
            <FormField label="Gender" required>
              <Select name="gender" required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </Select>
            </FormField>
            <FormField label="Contact Number" required>
              <Input name="phone" type="tel" placeholder="+46 70 000 0000" required />
            </FormField>
            <FormField label="City" required>
              <Input name="city" placeholder="Your city" required />
            </FormField>
            <FormField label="Country" required>
              <Select name="country" required defaultValue="">
                <option value="" disabled>
                  Select country
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value="Other">Other</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Email Address" required>
            <Input name="email" type="email" placeholder="you@example.com" required />
          </FormField>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <FormField label="Password" required>
              <Input name="password" type="password" placeholder="At least 6 characters" required />
            </FormField>
            <FormField label="Confirm Password" required>
              <Input name="confirmPassword" type="password" placeholder="Re-enter password" required />
            </FormField>
          </div>

          {error && (
            <div className="mt-1 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-danger">
              {error}
              {emailTaken && (
                <>
                  {" "}
                  <Link href="/login" className="font-bold underline">
                    Sign in →
                  </Link>
                </>
              )}
            </div>
          )}

          <Button type="submit" size="lg" fullWidth loading={busy} className="mt-5">
            {busy ? "Creating account…" : "Create Account & Book a Class →"}
          </Button>

          <p className="mt-4 text-center text-[13px] text-copy-dim">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-accent">
              Sign in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
