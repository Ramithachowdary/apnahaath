"use client";

import type { State, View } from "./types";
import { useT } from "./lang";

/** First-run checklist: the four steps that make the shared record useful. Hidden once all are done. */
export function SetupChecklist({ state, go }: { state: State; go: (t: View) => void }) {
  const { tr } = useT();
  const confirmed =
    state.history.some((h) => h.status === "elder_confirmed") ||
    state.doseSlots.some((h) => h.status === "elder_confirmed");
  const steps: { label: string; hint: string; done: boolean; tab: View; cta: string }[] = [
    {
      label: tr("check.meds"),
      hint: tr("check.medsHint"),
      done: state.medicines.length > 0,
      tab: "Medicines",
      cta: tr("check.medsCta"),
    },
    {
      label: tr("check.invite"),
      hint: tr("check.inviteHint"),
      done: state.members.length > 1,
      tab: "Care circle",
      cta: tr("check.inviteCta"),
    },
    {
      label: tr("check.confirm"),
      hint: tr("check.confirmHint"),
      done: confirmed,
      tab: "Today",
      cta: tr("check.confirmCta"),
    },
    {
      label: tr("check.brief"),
      hint: tr("check.briefHint"),
      done: false,
      tab: "Doctor brief",
      cta: tr("check.briefCta"),
    },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  if (doneCount >= 3 && state.history.length > 0) return null;
  return (
    <section aria-labelledby="setup-h" className="panel lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-h" className="text-xl font-semibold">
          {tr("check.title")}
        </h2>
        <p className="text-sm text-[var(--muted)]">{tr("check.progress", { done: doneCount, total: steps.length })}</p>
      </div>
      <div
        className="mt-3 h-1.5 w-full rounded-full bg-stone-200"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-1.5 rounded-full bg-[var(--brand)]"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {steps.map((x, i) => (
          <li
            key={x.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-3"
          >
            <div>
              <p className="font-semibold">
                {i + 1}. {x.label}{" "}
                {x.done && <span className="text-sm font-normal text-[var(--ok)]">· {tr("check.done")}</span>}
              </p>
              <p className="text-sm text-[var(--muted)]">{x.hint}</p>
            </div>
            {!x.done && (
              <button type="button" className="btn-ghost shrink-0" onClick={() => go(x.tab)}>
                {x.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
