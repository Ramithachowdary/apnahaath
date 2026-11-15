"use client";

/** Medicines tab: the list, family proposals and the elder accepting or declining them. */
import { useState } from "react";
import { formatTime12 } from "@/lib/time";
import { useT } from "./lang";
import type { State } from "./types";
import { api } from "./helpers";
import { TimeField, Empty } from "./ui";

function describeProposal(p: State["proposals"][number], meds: State["medicines"]) {
  let pl: Record<string, string> = {};
  try {
    pl = JSON.parse(p.payload_json);
  } catch {
    /* ignore */
  }
  const name = meds.find((m) => m.id === p.medicine_id)?.name ?? pl.name ?? "a medicine";
  if (p.kind === "add")
    return `Add ${name}${pl.dose ? ` (${pl.dose})` : ""} at ${pl.schedule_time ? formatTime12(pl.schedule_time) : ""}${pl.instructions ? ` — ${pl.instructions}` : ""}`;
  if (p.kind === "edit_schedule") return `Move ${name} to ${pl.schedule_time ? formatTime12(pl.schedule_time) : ""}`;
  if (p.kind === "stop") return `Stop ${name}${pl.reason ? ` — ${pl.reason}` : ""}`;
  return p.kind;
}

export function Medicines({
  state,
  busy,
  doAction,
}: {
  state: State;
  busy: boolean;
  doAction: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const { dayPart } = useT();
  const role = state.me.role;
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("09:00");
  const [instr, setInstr] = useState("");
  const [moveTime, setMoveTime] = useState<Record<string, string>>({});
  const active = state.medicines.filter((m) => m.active);
  const pending = state.proposals.filter((p) => p.status === "pending");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Medicine list</h2>
        <div className="mt-3 space-y-2">
          {active.length === 0 && (
            <Empty>
              No medicines yet. Use the form here to add {state.household.elder_name}&apos;s first medicine — for
              example the morning BP tablet, with its time. The elder accepts or declines each suggestion.
            </Empty>
          )}
          {active.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border bg-white p-3"
              style={{ borderLeftWidth: 8, borderLeftColor: m.color_band }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">
                    {m.name} <span className="font-normal text-[var(--muted)]">{m.dose}</span>
                  </p>
                  <p className="text-[var(--muted)]">
                    {formatTime12(m.schedule_time)} · {dayPart(m.schedule_time)}
                    {m.instructions ? ` · ${m.instructions}` : ""}
                  </p>
                </div>
                {role === "family" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <TimeField
                      className="input w-40"
                      value={moveTime[m.id] ?? m.schedule_time}
                      onChange={(v) => setMoveTime({ ...moveTime, [m.id]: v })}
                      label={`New time for ${m.name}`}
                    />
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        doAction(
                          () =>
                            api("/api/proposals", {
                              method: "POST",
                              body: JSON.stringify({
                                kind: "edit_schedule",
                                medicineId: m.id,
                                payload: { schedule_time: moveTime[m.id] ?? m.schedule_time },
                              }),
                            }),
                          "Suggestion sent. It changes only when the elder says yes.",
                        )
                      }
                    >
                      Suggest time
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        doAction(
                          () =>
                            api("/api/proposals", {
                              method: "POST",
                              body: JSON.stringify({
                                kind: "stop",
                                medicineId: m.id,
                                payload: { reason: "Discuss with the doctor" },
                              }),
                            }),
                          "Suggestion sent.",
                        )
                      }
                    >
                      Suggest stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        {role === "elder" && (
          <section className="panel">
            <h2 className="text-2xl font-semibold">Suggestions for you</h2>
            {pending.length === 0 && <Empty>No suggestions waiting.</Empty>}
            {pending.map((p) => (
              <div key={p.id} className="mt-3 rounded-xl border bg-white p-4">
                <p className="text-lg">{describeProposal(p, state.medicines)}</p>
                <p className="text-sm text-[var(--muted)]">Suggested by {p.created_by}. Is this okay with you?</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() =>
                      doAction(
                        () =>
                          api("/api/proposals", {
                            method: "PATCH",
                            body: JSON.stringify({ proposalId: p.id, decision: "accept" }),
                          }),
                        "Done. Your list is updated.",
                      )
                    }
                  >
                    Yes, okay
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      doAction(
                        () =>
                          api("/api/proposals", {
                            method: "PATCH",
                            body: JSON.stringify({ proposalId: p.id, decision: "reject" }),
                          }),
                        "Okay. Nothing was changed.",
                      )
                    }
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        {role === "family" && (
          <section className="panel">
            <h2 className="text-2xl font-semibold">Suggest a new medicine</h2>
            <p className="text-sm text-[var(--muted)]">
              It is added only after the elder says yes. Thyronorm and Shelcal must be 4+ hours apart (fixed rule).
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="input"
                placeholder="Name (e.g. Telma 40)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Medicine name"
              />
              <input
                className="input"
                placeholder="Dose (e.g. 40 mg)"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                aria-label="Dose"
              />
              <TimeField value={time} onChange={setTime} label="Time" />
              <input
                className="input"
                placeholder="Instructions (e.g. after breakfast)"
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                aria-label="Instructions"
              />
            </div>
            <button
              className="btn-primary mt-3"
              disabled={busy || !name}
              onClick={() =>
                doAction(
                  () =>
                    api("/api/proposals", {
                      method: "POST",
                      body: JSON.stringify({
                        kind: "add",
                        payload: { name, dose, schedule_time: time, instructions: instr },
                      }),
                    }),
                  "Suggestion sent to the elder.",
                )
              }
            >
              Send suggestion
            </button>
          </section>
        )}
        <section className="panel">
          <h2 className="text-xl font-semibold">All suggestions</h2>
          {state.proposals.length === 0 && <Empty>None yet.</Empty>}
          <ul className="mt-2 space-y-1">
            {state.proposals.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b py-1 text-sm">
                <span>{describeProposal(p, state.medicines)}</span>
                <span className="font-semibold">
                  {p.status === "pending" ? "Waiting for elder" : p.status === "accepted" ? "Accepted" : "Declined"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
