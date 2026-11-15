"use client";

/** Today tab: greeting, next-dose card, today's doses (elder confirms, caretaker witnesses) and self-reported medicines. */
import { useState } from "react";
import { Pill, Users } from "lucide-react";
import { greetingKey, istHour } from "./format";
import { useT } from "./lang";
import type { State, Tab } from "./types";
import { SKIP_REASONS, STATUS_LABEL } from "./constants";
import { api, time12, dayLabel } from "./helpers";
import { StatusChip, Stat, AddToGoogleCalendar } from "./ui";

/** First-run checklist: the four steps that make the shared record useful. Hidden once all are done. */
function SetupChecklist({ state, go }: { state: State; go: (t: Tab) => void }) {
  const { tr } = useT();
  const confirmed =
    state.history.some((h) => h.status === "elder_confirmed") ||
    state.doseSlots.some((h) => h.status === "elder_confirmed");
  const steps: { label: string; hint: string; done: boolean; tab: Tab; cta: string }[] = [
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
      tab: "Safety & AI",
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

export function Today({
  state,
  busy,
  doAction,
  setMsg,
  go,
}: {
  state: State;
  busy: boolean;
  doAction: (fn: () => Promise<unknown>, ok?: string) => void;
  setMsg: (m: { text: string; ok?: boolean } | null) => void;
  go: (t: Tab) => void;
}) {
  const role = state.me.role;
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [med, setMed] = useState("");
  const [dose, setDose] = useState("");
  const [why, setWhy] = useState("");
  const a = state.adherence;
  const { tr, dayPart } = useT();
  const hello = tr(greetingKey(istHour()));
  const next = state.doseSlots.find((s) => s.status === "pending");
  const taken = state.doseSlots.filter((s) => s.status === "elder_confirmed").length;
  const firstName = state.me.name.split(" ")[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <SetupChecklist state={state} go={go} />
      <section
        className="rounded-lg border border-[var(--line)] bg-[var(--soft)] p-5 lg:col-span-2"
        aria-label={role === "elder" ? "Your next dose" : "Today at a glance"}
      >
        <p className="text-lg font-semibold">
          {hello}, {firstName}
        </p>
        {next ? (
          <p className={role === "elder" ? "mt-2 text-2xl font-bold md:text-3xl" : "mt-2 text-xl font-semibold"}>
            {role === "elder" ? tr("today.nextDose") : tr("today.nextFor", { name: state.household.elder_name })}:{" "}
            {next.medicine_name} {tr("today.at")} {time12(next.scheduled_at)}
            <span className="block text-base font-normal text-[var(--muted)]">
              {dayPart(next.scheduled_at)}
              {next.instructions ? ` · ${next.instructions}` : ""}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xl font-semibold">
            {state.doseSlots.length > 0 ? tr("today.allDone") : tr("today.noDoses")}
          </p>
        )}
        {state.doseSlots.length > 0 && (
          <p className="mt-1 text-[var(--muted)]">{tr("today.takenCount", { taken, total: state.doseSlots.length })}</p>
        )}
      </section>
      <section className="panel">
        <h2 className="text-2xl font-semibold">{tr("today.medicines")}</h2>
        <div className="mt-4 space-y-3">
          {state.doseSlots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center">
              <Pill size={36} className="mx-auto text-[var(--brand)]" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold">{tr("today.emptyTitle")}</p>
              <p className="mx-auto mt-1 max-w-sm text-[var(--muted)]">
                {role === "elder" ? tr("today.emptyElder") : tr("today.emptyOther")}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => go("Medicines")}>
                  <Pill size={18} aria-hidden="true" /> {tr("today.addMedicine")}
                </button>
                {state.me.isOwner && (
                  <button className="btn-ghost" onClick={() => go("Care circle")}>
                    <Users size={18} aria-hidden="true" /> {tr("today.inviteMembers")}
                  </button>
                )}
              </div>
            </div>
          )}
          {state.doseSlots.map((slot) => (
            <article
              key={slot.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              style={{ borderLeftWidth: 8, borderLeftColor: slot.color_band }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className={role === "elder" ? "text-2xl font-bold md:text-3xl" : "text-xl font-semibold"}>
                    {slot.medicine_name}
                  </h3>
                  <p className={`text-[var(--muted)] ${role === "elder" ? "text-lg" : ""}`}>
                    {time12(slot.scheduled_at)} · {dayPart(slot.scheduled_at)}
                    {slot.instructions ? ` · ${slot.instructions}` : ""}
                  </p>
                  <p className="mt-2">
                    <StatusChip status={slot.status} extra={slot.skip_reason} />
                    <span className="sr-only"> ({STATUS_LABEL[slot.status] ?? slot.status})</span>
                  </p>
                </div>
                {role === "elder" && slot.status === "pending" && skipFor !== slot.id && (
                  <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                    <button
                      className="btn-primary min-h-[72px] w-full px-10 text-2xl sm:w-auto"
                      disabled={busy}
                      onClick={() =>
                        doAction(
                          () =>
                            api("/api/doses/confirm", {
                              method: "POST",
                              body: JSON.stringify({ doseSlotId: slot.id }),
                            }),
                          "Saved: you took it.",
                        )
                      }
                    >
                      Yes, I took it
                    </button>
                    <button
                      className="btn-ghost min-h-[60px] flex-1 text-lg sm:flex-none"
                      disabled={busy}
                      onClick={() => setSkipFor(slot.id)}
                    >
                      Not now
                    </button>
                    <button
                      className="btn-ghost min-h-[60px] flex-1 text-lg sm:flex-none"
                      disabled={busy}
                      onClick={() => setMsg({ text: "Okay. This dose stays open — you can answer later.", ok: true })}
                    >
                      Later
                    </button>
                  </div>
                )}
                {role === "elder" && slot.status === "pending" && skipFor === slot.id && (
                  <div className="flex max-w-md flex-wrap gap-2">
                    <p className="w-full font-semibold">Why not now?</p>
                    {SKIP_REASONS.map((r) => (
                      <button
                        key={r}
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => {
                          setSkipFor(null);
                          doAction(
                            () =>
                              api("/api/doses/skip", {
                                method: "POST",
                                body: JSON.stringify({ doseSlotId: slot.id, reason: r }),
                              }),
                            "Saved. A skip is your decision — it is not counted as missed.",
                          );
                        }}
                      >
                        {r}
                      </button>
                    ))}
                    <button className="btn-ghost" onClick={() => setSkipFor(null)}>
                      Back
                    </button>
                  </div>
                )}
                {role === "caretaker" && (
                  <button
                    className="btn-accent"
                    disabled={busy}
                    onClick={() =>
                      doAction(
                        () =>
                          api("/api/doses/witness", {
                            method: "POST",
                            body: JSON.stringify({ doseSlotId: slot.id }),
                          }),
                        "Saved as witnessed. Only the elder can mark it as taken.",
                      )
                    }
                  >
                    I saw her take it
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        <section className="panel">
          <h2 className="text-xl font-semibold">Today at a glance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Confirmed by elder" value={a.elderConfirmed} />
            <Stat label="Witnessed" value={a.witnessed} />
            <Stat label="Skipped" value={a.skipped} />
            <Stat label="Missed / not confirmed" value={a.missed} />
          </div>
          <div className="mt-3">
            <Stat
              label="Elder-confirmation rate"
              value={a.elderConfirmationRate == null ? "—" : `${a.elderConfirmationRate}%`}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Rate = confirmed ÷ (confirmed + missed). Skips are her decision, not failures. A witness never counts as
            taken.
          </p>
        </section>
        {role === "elder" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">I took it myself</h2>
            <p className="text-sm text-[var(--muted)]">
              Took something that is not on your list? Write it here so your family and doctor know.
            </p>
            <div className="mt-3 grid gap-2">
              <input
                className="input"
                placeholder="Medicine name (e.g. Brufen)"
                value={med}
                onChange={(e) => setMed(e.target.value)}
                aria-label="Medicine name"
              />
              <input
                className="input"
                placeholder="How much (e.g. 400 mg)"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                aria-label="How much"
              />
              <input
                className="input"
                placeholder="Why (e.g. knee pain)"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                aria-label="Why"
              />
              <button
                className="btn-primary"
                disabled={busy || !med}
                onClick={() =>
                  doAction(
                    () =>
                      api("/api/doses/self-add", {
                        method: "POST",
                        body: JSON.stringify({ medicineName: med, dose, reason: why, generateCard: true }),
                      }),
                    "Saved. A safety note was added under Safety.",
                  )
                }
              >
                Save and check safety
              </button>
            </div>
          </section>
        )}
        {state.appointments[0] && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Next appointment</h2>
            <p className="mt-2 text-lg">
              <strong>{state.appointments[0].doctor}</strong> — {state.appointments[0].place}
            </p>
            <p className="text-[var(--muted)]">
              {dayLabel(state.appointments[0].scheduled_at)}, {time12(state.appointments[0].scheduled_at)} IST
            </p>
            <AddToGoogleCalendar appointment={state.appointments[0]} elderName={state.household.elder_name} />
          </section>
        )}
      </div>
    </div>
  );
}
