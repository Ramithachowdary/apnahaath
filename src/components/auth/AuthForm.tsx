"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HandHeart, Mail } from "lucide-react";

export type AuthFn = (
  path: string,
  body: Record<string, string>,
  okText?: string,
) => Promise<Record<string, unknown> & { ok: boolean }>;

/** Step 1 of onboarding: the separate sign-up and sign-in pages (email + OTP, or Google). */
export default function AuthForm({
  initialMode,
  busy,
  onAuth,
  invite,
  toggles,
  googleEnabled = false,
}: {
  initialMode: "signup" | "login";
  busy: boolean;
  onAuth: AuthFn;
  invite: string;
  toggles?: React.ReactNode;
  googleEnabled?: boolean;
}) {
  const [mode] = useState<"signup" | "login">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyFor, setVerifyFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function submit() {
    if (mode === "signup") {
      const r = await onAuth("/api/auth/signup", { name, email, password });
      if (r.needsVerification) {
        setVerifyFor(String(r.email || email));
        setCooldown(Number(r.retryAfterS) || 60);
        setCode("");
      }
    } else {
      const r = await onAuth("/api/auth/login", { email, password });
      if (r.needsVerification) {
        setVerifyFor(String(r.email || email));
        setCode("");
      }
    }
  }
  const q = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-[var(--brand)]">
            <HandHeart size={24} /> ApnaHaath
          </Link>
          {toggles}
        </div>
      </header>
      <main id="top">
        <section id="account" className="border-y border-stone-200 bg-white py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
            <div>
              {mode === "signup" && (
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
                  Step 1 of 2 · Account
                </p>
              )}
              <h1 className="text-3xl font-bold md:text-4xl">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-lg text-[var(--muted)]">
                {mode === "signup"
                  ? "Create your account, then add your elder and invite the family. Invited? Sign up with the email you want to use, then join with your invite."
                  : "Sign in to see today's medicines and your care circle."}
              </p>
            </div>
            <div className="panel">
              <p className="mb-5 text-[var(--muted)]">
                {mode === "signup" ? "Already have an account? " : "New to ApnaHaath? "}
                <a
                  className="font-semibold text-[var(--brand)] underline"
                  href={mode === "signup" ? `/signin${q}` : `/signup${q}`}
                >
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </a>
              </p>
              {invite && (
                <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                  You have an invite. Sign up or sign in first , you can join right after.
                </p>
              )}
              {verifyFor ? (
                <form
                  className="grid gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onAuth(
                      "/api/auth/verify",
                      { email: verifyFor, code },
                      "Email verified. Welcome to ApnaHaath!",
                    );
                  }}
                >
                  <div className="flex items-start gap-3 rounded-xl bg-[var(--soft)] p-4">
                    <Mail size={22} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                    <p>
                      We sent a 6-digit code to <strong className="break-all">{verifyFor}</strong>. It expires in 10
                      minutes.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="otp-code" className="mb-1 block text-sm font-semibold">
                      Verification code
                    </label>
                    <input
                      id="otp-code"
                      className="input text-center text-2xl tracking-[0.5em]"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />
                  </div>
                  <button className="btn-primary w-full text-lg" disabled={busy || code.length !== 6} type="submit">
                    {busy ? "Checking…" : "Verify and continue"}
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy || cooldown > 0}
                      onClick={async () => {
                        const r = await onAuth("/api/auth/resend", { email: verifyFor }, "A new code is on its way.");
                        setCooldown(Number(r.retryAfterS) || 60);
                      }}
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-[var(--brand)] underline"
                      style={{ minHeight: 44 }}
                      onClick={() => setVerifyFor(null)}
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {googleEnabled && (
                    <>
                      <a href="/api/auth/google" className="btn-ghost w-full text-base">
                        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                          <path
                            fill="#FFC107"
                            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                          />
                          <path
                            fill="#FF3D00"
                            d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                          />
                          <path
                            fill="#4CAF50"
                            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
                          />
                          <path
                            fill="#1976D2"
                            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                          />
                        </svg>
                        Continue with Google
                      </a>
                      <p className="my-4 flex items-center gap-3 text-sm text-[var(--muted)]">
                        <span className="h-px flex-1 bg-stone-200" /> or with email{" "}
                        <span className="h-px flex-1 bg-stone-200" />
                      </p>
                    </>
                  )}
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit();
                    }}
                  >
                    {mode === "signup" && (
                      <div>
                        <label htmlFor="auth-name" className="mb-1 block text-sm font-semibold">
                          Your name
                        </label>
                        <input
                          id="auth-name"
                          className="input"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label htmlFor="auth-email" className="mb-1 block text-sm font-semibold">
                        Email
                      </label>
                      <input
                        id="auth-email"
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="auth-password" className="mb-1 block text-sm font-semibold">
                        Password{mode === "signup" ? " (at least 8 characters)" : ""}
                      </label>
                      <input
                        id="auth-password"
                        className="input"
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "signup" ? 8 : 1}
                      />
                    </div>
                    <button className="btn-primary w-full text-lg" disabled={busy} type="submit">
                      {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                    </button>
                    {mode === "signup" && (
                      <p className="text-center text-sm text-[var(--muted)]">
                        We will email you a 6-digit code to confirm it is you.
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
