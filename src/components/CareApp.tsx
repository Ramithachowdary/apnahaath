"use client";

/** Signed-in shell for /onboarding and /app: loads the account and care circle, runs actions, shows toasts. */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Me, State } from "./app/types";
import { api } from "./app/helpers";
import { AppFooter, TopBar } from "./app/ui";
import { OpeningScreen, Toast, useFlash } from "./app/Toast";
import { Onboarding } from "./app/Onboarding";
import { Dashboard } from "./app/Dashboard";
import { routeFor } from "@/lib/routing";

/** Account plus, when the account has an active care circle, everything in it. */
async function loadSession(expectCircle: boolean): Promise<{ me: Me; state: State | null }> {
  // When the visitor already had a circle, fetch both at once instead of one after the other.
  const early = expectCircle ? (api("/api/state") as Promise<State>) : null;
  early?.catch(() => undefined);
  const me = (await api("/api/auth/me")) as Me;
  if (!me.authenticated || !me.activeHouseholdId) return { me, state: null };
  return { me, state: await (early ?? (api("/api/state") as Promise<State>)) };
}

export default function CareApp({ view }: { view: "onboarding" | "app" }) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useFlash();
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const hadCircle = useRef(view === "app");

  const refresh = useCallback(async () => {
    const next = await loadSession(hadCircle.current);
    hadCircle.current = next.state !== null;
    setMe(next.me);
    setState(next.state);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) setInvite(code);
    refresh().catch((e) => setMsg({ text: String(e instanceof Error ? e.message : e) }));
  }, [refresh, setMsg]);

  // Route guard: send each visitor to the step that matches their account and circle.
  const target = me ? routeFor(me, view, typeof window === "undefined" ? "" : window.location.search) : null;
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);

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
  const toast = <Toast msg={msg} onDismiss={() => setMsg(null)} />;

  if (!me || target) {
    return (
      <>
        <OpeningScreen />
        {toast}
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
        {toast}
      </>
    );
  }
  return (
    <>
      <Dashboard state={state} busy={busy} act={act} doAction={doAction} setMsg={setMsg} onLogout={logout} />
      {toast}
    </>
  );
}
