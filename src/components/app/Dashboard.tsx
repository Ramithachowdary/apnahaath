"use client";

/** Signed-in shell: sidebar / bottom navigation and the active tab. */
import { useState } from "react";
import { HandHeart, LogOut } from "lucide-react";
import type { State, Tab, View, ActFn } from "./types";
import { ROLE_LABEL, SUBTABS, SUB_ICON, TABS, TAB_ICON, TAB_SUB, VIEW_HOME } from "./constants";
import { AppFooter, DisplayToggles } from "./ui";
import { LanguageSelect, useT } from "./lang";
import type { MsgKey } from "@/lib/i18n";

/** Translation keys for section and tab names that the language file already covers. */
const NAME_KEY: Record<string, string> = {
  Today: "nav.today",
  "Care circle": "nav.circle",
  Medicines: "nav.medicines",
  Appointments: "nav.appointments",
  History: "nav.history",
};
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
  const [sub, setSub] = useState<Record<string, string>>({ "Care plan": "Medicines", "Activity & safety": "History" });
  const { tr } = useT();
  const name = (t: string) => (NAME_KEY[t] ? tr(NAME_KEY[t] as MsgKey) : t);
  const role = state.me.role;
  const pendingForElder = state.proposals.filter((p) => p.status === "pending");
  /** Open a section, or a view inside a section (e.g. "Medicines" opens Care plan, Medicines tab). */
  const go = (v: Tab | View) => {
    const home = VIEW_HOME[v] ?? { tab: v as Tab };
    setTab(home.tab);
    if (home.sub) setSub((s) => ({ ...s, [home.tab]: home.sub as string }));
    setMsg(null);
    window.scrollTo({ top: 0 });
  };
  const badge = (t: Tab) =>
    t === "Care plan" && role === "elder" && pendingForElder.length > 0 ? pendingForElder.length : 0;
  const view = (SUBTABS[tab] ? sub[tab] : tab) as View;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
        <p className="flex items-center gap-2 px-2 text-lg font-bold text-[var(--brand)]">
          <HandHeart size={24} aria-hidden="true" /> ApnaHaath
        </p>
        <div className="mt-6 rounded-2xl bg-[var(--soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Person receiving care</p>
          <p className="mt-1 text-lg font-bold">{state.household.elder_name}</p>
          <p className="text-sm text-[var(--muted)]">
            {tr("app.you")}: {state.me.name} · {ROLE_LABEL[role]}
          </p>
        </div>
        <nav className="mt-6 space-y-1" aria-label="Sections">
          {TABS.map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button key={t} className="nav-item" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
                <Icon size={20} aria-hidden="true" /> <span className="flex-1">{name(t)}</span>
                {badge(t) > 0 && (
                  <span className="rounded-full bg-[var(--brand-2)] px-2 text-xs font-bold text-white">{badge(t)}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <LanguageSelect className="px-2" />
          <DisplayToggles />
          <button className="nav-item" onClick={onLogout}>
            <LogOut size={20} aria-hidden="true" /> {tr("app.signOut")}
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
              Caring for {state.household.elder_name} · You: {ROLE_LABEL[role]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <button className="btn-ghost px-3" onClick={onLogout} aria-label={tr("app.signOut")}>
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-10 lg:py-10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{name(tab)}</h1>
            <p className="mt-1 text-[var(--muted)]">{TAB_SUB[tab]}</p>
          </div>
          {SUBTABS[tab] && (
            <div
              role="tablist"
              aria-label={`${tab} sections`}
              className="no-print mb-6 flex flex-wrap gap-1 border-b border-stone-200"
            >
              {SUBTABS[tab].map((v) => {
                const Icon = SUB_ICON[v];
                const on = sub[tab] === v;
                return (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={on}
                    className={`-mb-px flex min-h-[48px] items-center gap-2 border-b-2 px-4 font-semibold ${on ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-stone-900"}`}
                    onClick={() => go(v as View)}
                  >
                    <Icon size={18} aria-hidden="true" /> {name(v)}
                    {v === "Medicines" && role === "elder" && pendingForElder.length > 0 && (
                      <span className="rounded-full bg-[var(--brand-2)] px-2 text-xs font-bold text-white">
                        {pendingForElder.length}
                        <span className="sr-only"> suggestions need your answer</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {view === "Today" && <Today state={state} busy={busy} doAction={doAction} setMsg={setMsg} go={go} />}
          {view === "Medicines" && <Medicines state={state} busy={busy} doAction={doAction} />}
          {view === "Appointments" && <Appointments state={state} busy={busy} doAction={doAction} />}
          {view === "History" && (
            <>
              <History state={state} />
              <WeeklySummary state={state} busy={busy} act={act} />
            </>
          )}
          {view === "Safety notes" && <Safety state={state} busy={busy} act={act} part="notes" />}
          {view === "Doctor brief" && <Safety state={state} busy={busy} act={act} part="brief" />}
          {view === "Care circle" && <Circle state={state} busy={busy} act={act} go={go} />}
          <AppFooter city={state.household.city} />
          <div className="mt-4 lg:hidden">
            <DisplayToggles />
          </div>
        </main>
      </div>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Sections"
      >
        {TABS.map((t) => {
          const Icon = TAB_ICON[t];
          return (
            <button
              key={t}
              className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${tab === t ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => go(t)}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="leading-tight">
                {t === "Activity & safety" ? "Activity" : t === "Care circle" ? tr("navShort.circle") : name(t)}
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
