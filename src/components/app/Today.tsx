"use client";

/** Today tab: greeting, next-dose card, today's doses (elder confirms, caretaker witnesses) and self-reported medicines. */
import { useState } from "react";
import { Pill, Users } from "lucide-react";
import { dayPartLabel, greeting, istHour } from "./format";
import type { State, Tab } from "./types";
import { SKIP_REASONS, STATUS_LABEL } from "./constants";
import { api, time12, dayLabel } from "./helpers";
import { StatusChip, Stat, AddToGoogleCalendar } from "./ui";

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
  const hello = greeting(istHour());
  const next = state.doseSlots.find((s) => s.status === "pending");
  const taken = state.doseSlots.filter((s) => s.status === "elder_confirmed").length;
  const firstName = state.me.name.split(" ")[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section
        className="rounded-3xl bg-[var(--soft)] p-5 lg:col-span-2"
        aria-label={role === "elder" ? "Your next dose" : "Today at a glance"}
      >
        <p className="text-lg font-semibold">
          {hello.hi} {firstName} · <span className="font-normal text-[var(--muted)]">{hello.en}</span>
        </p>
        {next ? (
          <p className={role === "elder" ? "mt-2 text-2xl font-bold md:text-3xl" : "mt-2 text-xl font-semibold"}>
            {role === "elder" ? "Next dose · agli dawai: " : `Next for ${state.household.elder_name}: `}
            {next.medicine_name} at {time12(next.scheduled_at)}
            <span className="block text-base font-normal text-[var(--muted)]">
              {dayPartLabel(next.scheduled_at)}
              {next.instructions ? ` · ${next.instructions}` : ""}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xl font-semibold">
            {state.doseSlots.length > 0
              ? "All of today's doses are answered. Shabash! 🌼"
              : "No doses scheduled today."}
          </p>
        )}
        {state.doseSlots.length > 0 && (
          <p className="mt-1 text-[var(--muted)]">
            {taken} of {state.doseSlots.length} taken today
          </p>
        )}
      </section>
      <section className="panel">
        <h2 className="text-2xl font-semibold">Today&apos;s medicines</h2>
        <div className="mt-4 space-y-3">
          {state.doseSlots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center">
              <Pill size={36} className="mx-auto text-[var(--brand)]" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold">No medicines for today yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[var(--muted)]">
                {role === "elder"
                  ? "Add your medicines, or ask family to suggest them — you accept each one."
                  : "Suggest the first medicine. The elder accepts it, then it shows up here every day."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => go("Medicines")}>
                  <Pill size={18} aria-hidden="true" /> Add a medicine
                </button>
                {state.me.isOwner && (
                  <button className="btn-ghost" onClick={() => go("Care circle")}>
                    <Users size={18} aria-hidden="true" /> Invite members
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
                    {time12(slot.scheduled_at)} · {dayPartLabel(slot.scheduled_at)}
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
