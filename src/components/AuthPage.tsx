"use client";

/** The sign-up and sign-in pages: the account form, its API calls and the redirect afterwards. */
import { useCallback, useEffect, useState } from "react";
import AuthForm, { type AuthFn } from "./auth/AuthForm";
import type { Me } from "./app/types";
import { api } from "./app/helpers";
import { DisplayToggles } from "./app/ui";
import { OpeningScreen, Toast, useFlash } from "./app/Toast";
import { inviteQuery, routeFor } from "@/lib/routing";

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is not available right now. Please use email.",
};
const GOOGLE_FAILED = "Google sign-in did not finish. Please try again or use email.";

export default function AuthPage({
  view,
  hasSession = false,
  googleEnabled = false,
}: {
  view: "signup" | "signin";
  /** A session cookie exists, so check the account before showing the form. */
  hasSession?: boolean;
  googleEnabled?: boolean;
}) {
  const [showForm, setShowForm] = useState(!hasSession);
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");

  /** Send a signed-in visitor to onboarding or the dashboard; otherwise show the form. */
  const goToAccount = useCallback(async () => {
    const me = (await api("/api/auth/me")) as Me;
    const target = routeFor(me, view, window.location.search);
    if (target) {
      setShowForm(false);
      window.location.replace(target);
    } else setShowForm(true);
  }, [view]);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const code = qs.get("invite");
    if (code) setInvite(code);
    const authError = qs.get("auth_error");
    if (authError) {
      setMsg({ text: GOOGLE_ERRORS[authError] ?? GOOGLE_FAILED });
      window.history.replaceState(null, "", window.location.pathname + inviteQuery(code));
    }
    if (hasSession)
      goToAccount().catch((e) => {
        setMsg({ text: String(e instanceof Error ? e.message : e) });
        setShowForm(true);
      });
  }, [hasSession, goToAccount, setMsg]);

  const onAuth: AuthFn = async (path, body, okText) => {
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
      if (res.ok && !data.needsVerification && path !== "/api/auth/resend") await goToAccount();
      return { ok: res.ok, ...data };
    } catch {
      setMsg({ text: "Network problem. Please try again." });
      return { ok: false };
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showForm ? (
        <AuthForm
          initialMode={view === "signin" ? "login" : "signup"}
          busy={busy}
          invite={invite}
          googleEnabled={googleEnabled}
          toggles={<DisplayToggles />}
          onAuth={onAuth}
        />
      ) : (
        <OpeningScreen />
      )}
      <Toast msg={msg} onDismiss={() => setMsg(null)} />
    </>
  );
}
