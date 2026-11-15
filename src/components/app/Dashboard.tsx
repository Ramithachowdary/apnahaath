"use client";

/** Signed-in shell: sidebar / bottom navigation and the active tab. */
import { useState } from "react";
import { HandHeart, LogOut } from "lucide-react";
import type { State, Tab, ActFn } from "./types";
import { ROLE_LABEL, TABS, TAB_ICON, TAB_SUB } from "./constants";
import { AppFooter, DisplayToggles } from "./ui";
import { Today } from "./Today";
import { Medicines } from "./Medicines";
import { WeeklySummary, History } from "./History";
import { Appointments } from "./Appointments";
import { Safety } from "./Safety";
import { Circle } from "./Circle";

export function Dashboard({
  state,
  busy,
  act,
  doAction,
  setMsg,
  onLogout,
}: {
  state: State;
  busy: boolean;
  act: ActFn;
  doAction: (fn: () => Promise<unknown>, ok?: string) => void;
  setMsg: (m: { text: string; ok?: boolean } | null) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Today");
  const role = state.me.role;
  const pendingForElder = state.proposals.filter((p) => p.status === "pending");
  const go = (t: Tab) => {
    setTab(t);
    setMsg(null);
    window.scrollTo({ top: 0 });
  };
  const badge = (t: Tab) =>
    t === "Medicines" && role === "elder" && pendingForElder.length > 0 ? pendingForElder.length : 0;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
        <p className="flex items-center gap-2 px-2 text-lg font-bold text-[var(--brand)]">
          <HandHeart size={24} aria-hidden="true" /> ApnaHaath
        </p>
        <div className="mt-6 rounded-2xl bg-[var(--soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Care circle</p>
          <p className="mt-1 text-lg font-bold">{state.household.elder_name}</p>
          <p className="text-sm text-[var(--muted)]">
            You: {state.me.name} · {ROLE_LABEL[role]}
          </p>
        </div>
        <nav className="mt-6 space-y-1" aria-label="Sections">
          {TABS.map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button key={t} className="nav-item" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
                <Icon size={20} aria-hidden="true" /> <span className="flex-1">{t}</span>
                {badge(t) > 0 && (
                  <span className="rounded-full bg-[var(--brand-2)] px-2 text-xs font-bold text-white">{badge(t)}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <DisplayToggles />
          <button className="nav-item" onClick={onLogout}>
            <LogOut size={20} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
          <div>
            <p className="flex items-center gap-1.5 font-bold text-[var(--brand)]">
              <HandHeart size={20} aria-hidden="true" /> ApnaHaath
            </p>
            <p className="text-sm text-[var(--muted)]">
              {state.household.elder_name} · you are {ROLE_LABEL[role]}
            </p>
          </div>
          <button className="btn-ghost px-3" onClick={onLogout} aria-label="Sign out">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-10 lg:py-10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{tab}</h1>
            <p className="mt-1 text-[var(--muted)]">{TAB_SUB[tab]}</p>
          </div>
          {tab === "Today" && <Today state={state} busy={busy} doAction={doAction} setMsg={setMsg} go={go} />}
          {tab === "Medicines" && <Medicines state={state} busy={busy} doAction={doAction} />}
          {tab === "History" && (
            <>
              <WeeklySummary state={state} busy={busy} act={act} />
              <History state={state} />
            </>
          )}
          {tab === "Appointments" && <Appointments state={state} busy={busy} doAction={doAction} />}
          {tab === "Safety & AI" && <Safety state={state} busy={busy} act={act} />}
          {tab === "Care circle" && <Circle state={state} busy={busy} act={act} />}
          <AppFooter city={state.household.city} />
          <div className="mt-4 lg:hidden">
            <DisplayToggles />
          </div>
        </main>
      </div>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Sections"
      >
        {TABS.map((t) => {
          const Icon = TAB_ICON[t];
          return (
            <button
              key={t}
              className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${tab === t ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => go(t)}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="leading-tight">
                {t === "Appointments" ? "Visits" : t === "Care circle" ? "Circle" : t === "Safety & AI" ? "Safety" : t}
              </span>
              {badge(t) > 0 && (
                <span
                  className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[var(--brand-2)]"
                  aria-label="needs your answer"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
