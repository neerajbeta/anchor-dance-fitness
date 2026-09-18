"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandLogo, BrandMark } from "@/components/theme/BrandLogo";
import { Input } from "@/components/theme/Input";
import { Button } from "@/components/theme/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GoogleButton } from "@/components/GoogleButton";
import { BookDemoButton } from "@/components/BookDemoButton";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up yet — use email instead.",
  google_denied: "Google sign-in was cancelled.",
  google_auth_failed: "Google sign-in failed. Please try again.",
  google_email_unverified: "That Google account's email isn't verified.",
  database_not_configured: "Sign-in is temporarily unavailable. Please try again shortly.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const googleErrorMessage = errorCode
    ? GOOGLE_ERRORS[errorCode] ?? "Sign-in failed. Please try again."
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const errorMessage = loginError ?? googleErrorMessage;

  // Studio cities for the brand panel, from the admin-managed Locations table.
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((j) => setCities(((j.data ?? []) as { label: string }[]).map((l) => l.label)))
      .catch(() => {});
  }, []);

  async function signIn() {
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Sign-in failed");
      router.push("/portal");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div className="ink-panel noise-overlay relative flex flex-col justify-center overflow-hidden px-12 py-16 text-white md:flex-1">
        <div className="relative z-10 max-w-md">
          <BrandMark size={56} className="mb-6" />
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-accent-warm">
            Anchor Dance &amp; Fitness Portal
          </div>
          <h1 className="mb-4 font-oswald text-4xl font-extrabold italic leading-tight">
            Move. Grow.
            <br />
            Stay Connected.
          </h1>
          <p className="mb-8 text-[15px] leading-relaxed text-white/65">
            Book classes, workshops, and studio time — all in one place.
          </p>
          <ul className="flex flex-col gap-3 text-sm text-white/80">
            {[
              "Dance classes · Workshops & Events · Studio hire",
              "Online & offline modes — shown on every booking & receipt",
              cities.length > 0 ? `Multi-city: ${cities.join(" · ")}` : null,
            ]
              .filter((t): t is string => Boolean(t))
              .map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <BookDemoButton className="btn btn-primary btn-lg" />
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-panel flex flex-col justify-center px-8 py-12 md:w-[460px] md:px-10">
        <div className="mb-6 flex items-center justify-between">
          <BrandLogo variant="light" size="sm" href="/" />
          <ThemeToggle tone="on-light" showLabel={false} />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-danger">
            {errorMessage}
          </div>
        )}

        <div className="animate-sheet">
          <h2 className="mb-1 font-oswald text-2xl font-bold italic text-copy">Welcome back 👋</h2>
          <p className="mb-5 text-[13px] text-copy-dim">Sign in to continue</p>
          <GoogleButton label="Continue with Google" />
          <Divider label="or sign in with email" />
          <label className="mb-3.5 block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
              Email
            </span>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="mb-1 block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-copy-dim">
              Password
            </span>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </label>
          <div className="mb-4 text-right">
            <span className="cursor-pointer text-xs font-semibold text-accent">Forgot password?</span>
          </div>
          <Button fullWidth size="lg" loading={busy} onClick={signIn} className="mb-3">
            {busy ? "Signing in…" : "Sign In"}
          </Button>
          <p className="text-center text-[13px] text-copy-dim">
            No account?{" "}
            <Link href="/register" className="font-semibold text-accent">
              Sign Up
            </Link>
          </p>
          <div className="mt-2 text-center">
            <Link href="/admin/login" className="text-[13px] font-semibold text-accent">
              🔐 Admin Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-copy-dim">
      <span className="h-px flex-1 bg-hairline" />
      {label}
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
