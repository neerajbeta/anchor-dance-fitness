"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { LogoMark } from "@/components/Logo";
import { loginAction, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export default function AdminLogin() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div
        className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle,#EF5B2B,transparent 70%)" }}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-cream p-8 shadow-pop animate-scale-in">
        <div className="mb-5 flex flex-col items-center text-center">
          <LogoMark size={52} className="mb-4" />
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-extrabold text-ink">Admin Portal</h1>
            <span className="badge badge-brand">RESTRICTED</span>
          </div>
          <p className="mt-1 text-[13px] text-slate">Sign in to manage Anchor Fitness</p>
        </div>

        <form action={formAction}>
          <div className="mb-3.5">
            <label className="field-label" htmlFor="email">
              Admin Email
            </label>
            <input
              id="email"
              name="email"
              className="field"
              type="email"
              defaultValue="admin@anchorfitness.com"
              required
            />
          </div>
          <div className="mb-1">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              className="field"
              type="password"
              autoFocus
              placeholder="Enter admin password"
              required
            />
          </div>

          {state.error && (
            <div className="mb-2 mt-2 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
              {state.error}
            </div>
          )}

          <SubmitButton />
        </form>

        <div className="mt-4 rounded-lg border-[1.5px] border-warn/40 bg-warn/10 px-3 py-2.5 text-[11px] leading-relaxed text-[#7a5512]">
          <strong>Demo build:</strong> default login is{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-bold text-ink">
            admin@anchorfitness.com
          </code>{" "}
          /{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-bold text-ink">
            anchor-admin
          </code>
          . Sessions use a signed httpOnly cookie; set real admins in the DB &amp; a strong{" "}
          <code className="font-bold text-ink">AUTH_SECRET</code>.
        </div>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-[13px] font-semibold text-brand-600">
            ← Back to user sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-block btn-lg mt-4" disabled={pending}>
      {pending ? "Signing in…" : "🔐 Sign In to Admin"}
    </button>
  );
}
