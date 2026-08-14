"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogoMark, LogoWordmark } from "@/components/Logo";
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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? GOOGLE_ERRORS[errorCode] ?? "Sign-in failed. Please try again." : null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-center overflow-hidden bg-ink px-12 py-16 text-white md:flex-1">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle,#EF5B2B,transparent 70%)" }}
        />
        <div className="relative z-10 max-w-md">
          <LogoMark size={56} className="mb-6" />
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-brand-400">
            Anchor Fitness Portal
          </div>
          <h1 className="mb-4 font-display text-4xl font-extrabold leading-tight">
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
              "Multi-city: Stockholm · Mumbai · London · NYC",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
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
      <div className="flex flex-col justify-center bg-cream px-8 py-12 md:w-[440px] md:px-10">
        <div className="mb-6">
          <LogoWordmark size={34} dark />
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3.5 py-2.5 text-[13px] font-medium text-danger">
            {errorMessage}
          </div>
        )}

        {mode === "login" ? (
          <div className="animate-scale-in">
            <h2 className="mb-1 font-display text-2xl font-bold text-ink">Welcome back 👋</h2>
            <p className="mb-5 text-[13px] text-slate">Sign in to continue</p>
            <GoogleButton label="Continue with Google" />
            <Divider label="or sign in with email" />
            <div className="mb-3.5">
              <label className="field-label">Email</label>
              <input className="field" type="email" placeholder="you@example.com" />
            </div>
            <div className="mb-1">
              <label className="field-label">Password</label>
              <input className="field" type="password" placeholder="••••••••" />
            </div>
            <div className="mb-4 text-right">
              <a className="cursor-pointer text-xs font-semibold text-brand-600">Forgot password?</a>
            </div>
            <Link href="/portal" className="btn btn-primary btn-block btn-lg mb-3">
              Sign In
            </Link>
            <p className="text-center text-[13px] text-slate">
              No account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="font-semibold text-brand-600"
              >
                Sign Up
              </button>
            </p>
            <div className="mt-2 text-center">
              <Link href="/admin/login" className="text-[13px] font-semibold text-brand-600">
                🔐 Admin Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="animate-scale-in">
            <h2 className="mb-1 font-display text-2xl font-bold text-ink">Create account ✨</h2>
            <p className="mb-5 text-[13px] text-slate">Join Anchor Fitness</p>
            <GoogleButton label="Sign up with Google" />
            <Divider label="or use email" />
            <div className="mb-3.5">
              <label className="field-label">Email</label>
              <input className="field" type="email" placeholder="you@example.com" />
            </div>
            <div className="mb-4">
              <label className="field-label">Password</label>
              <input className="field" type="password" placeholder="Create a password" />
            </div>
            <Link href="/register" className="btn btn-primary btn-block btn-lg mb-3">
              Create Account &amp; Continue →
            </Link>
            <p className="text-center text-[13px] text-slate">
              Have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="font-semibold text-brand-600"
              >
                Sign In
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
