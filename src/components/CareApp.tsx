"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import Landing from "./Landing";
import AuthForm from "./auth/AuthForm";
import type { Me, State } from "./app/types";
import { api } from "./app/helpers";
import { AppFooter, DisplayToggles, TopBar } from "./app/ui";
import { Onboarding } from "./app/Onboarding";
import { Dashboard } from "./app/Dashboard";

export default function CareApp({
  hasSession = true,
  googleEnabled = false,
  view = "landing",
}: {
  hasSession?: boolean;
  googleEnabled?: boolean;
  /** Which route rendered the app: each step of sign-up and onboarding has its own page. */
  view?: "landing" | "signup" | "signin" | "onboarding" | "app";
}) {
  // Without a session cookie the landing page renders on the server (no loading flash / layout shift).
  const [me, setMe] = useState<Me | null>(hasSession ? null : { authenticated: false });
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.ok ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [msg]);

  const refresh = useCallback(async () => {
    const m = (await api("/api/auth/me")) as Me;
    setMe(m);
    if (m.authenticated && m.activeHouseholdId) setState((await api("/api/state")) as State);
    else setState(null);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const code = qs.get("invite");
    if (code) setInvite(code);
    const authError = qs.get("auth_error");
    if (authError) {
      setMsg({
        text:
          authError === "google_unavailable"
            ? "Google sign-in is not available right now. Please use email."
            : "Google sign-in did not finish. Please try again or use email.",
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (code ? `?invite=${encodeURIComponent(code)}` : ""),
      );
    }
    refresh().catch((e) => setMsg({ text: String(e.message || e) }));
  }, [refresh]);

  // Route guards: send each visitor to the step that matches their account and circle.
  useEffect(() => {
    if (!me) return;
    const search = window.location.search;
    let target: string | null = null;
    if (!me.authenticated) {
      if (view === "app" || view === "onboarding") target = `/signin${search}`;
    } else {
      const hasCircle = Boolean(me.activeHouseholdId);
      if (view !== "app" && hasCircle) target = "/app";
      else if (view !== "onboarding" && !hasCircle) target = `/onboarding${search}`;
    }
    if (target) window.location.replace(target);
  }, [me, view]);

  async function act(fn: () => Promise<unknown>, okText?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refresh();
      if (okText) setMsg({ text: okText, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  /** Authoring actions are attributed to the signed-in account and its role in this circle. */
  function doAction(fn: () => Promise<unknown>, okText?: string) {
    void act(fn, okText);
  }

  const logout = () => act(() => api("/api/auth/logout", { method: "POST" }));
  const overlay = (
    <>
      {msg && (
        <div className="no-print fixed inset-x-4 bottom-24 z-40 flex justify-center lg:bottom-6 lg:left-auto lg:right-6 lg:justify-end">
          <p
            role="status"
            className={`flex max-w-md items-start gap-2 rounded-2xl border px-4 py-3 shadow-lg ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}
          >
            {msg.ok ? (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{msg.text}</span>
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() => setMsg(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </p>
        </div>
      )}
    </>
  );

  const redirecting =
    me &&
    (me.authenticated ? Boolean(me.activeHouseholdId) !== (view === "app") : view === "app" || view === "onboarding");
  if (!me || redirecting) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-6xl px-5 py-16" aria-busy="true">
        <p className="text-lg text-[var(--muted)]">Opening your care circle…</p>
      </main>
    );
  }
  if (!me.authenticated) {
    return (
      <>
        {view === "signup" || view === "signin" ? (
          <AuthForm
            initialMode={view === "signin" ? "login" : "signup"}
            busy={busy}
            invite={invite}
            googleEnabled={googleEnabled}
            toggles={<DisplayToggles />}
            onAuth={async (path, body, okText) => {
              setBusy(true);
              setMsg(null);
              try {
                const res = await fetch(path, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                if (!res.ok) setMsg({ text: String(data.error || "Something went wrong") });
                else if (okText) setMsg({ text: okText, ok: true });
                if (res.ok && !data.needsVerification && path !== "/api/auth/resend") await refresh();
                return { ok: res.ok, ...data };
              } catch {
                setMsg({ text: "Network problem. Please try again." });
                return { ok: false };
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <Landing invite={invite} toggles={<DisplayToggles />} />
        )}
        {overlay}
      </>
    );
  }
  if (!state) {
    return (
      <>
        <main className="mx-auto max-w-5xl px-5 py-8 pb-24">
          <TopBar me={me} state={null} onLogout={logout} />
          <ol aria-label="Setup progress" className="mb-6 mt-2 flex flex-wrap gap-3 text-sm font-semibold">
            <li className="chip bg-emerald-50 text-[var(--ok)] ring-emerald-200">
              <CheckCircle2 size={16} aria-hidden="true" /> 1 Account
            </li>
            <li className="chip bg-white text-[var(--brand)] ring-[var(--brand)]" aria-current="step">
              2 Care circle
            </li>
          </ol>
          <Onboarding me={me} busy={busy} act={act} invite={invite} />
          <AppFooter />
        </main>
        {overlay}
      </>
    );
  }
  return (
    <>
      <Dashboard state={state} busy={busy} act={act} doAction={doAction} setMsg={setMsg} onLogout={logout} />
      {overlay}
    </>
  );
}
