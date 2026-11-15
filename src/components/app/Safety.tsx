"use client";

/** Activity & safety: warn-only medicine safety notes, role messages, doctor brief and email reminder status. */
import { useState } from "react";
import type { State, ActFn } from "./types";
import { api, time12, dayLabel } from "./helpers";
import { Empty, ShareButtons } from "./ui";

export function Safety({
  state,
  busy,
  act,
  part = "notes",
}: {
  state: State;
  busy: boolean;
  act: ActFn;
  part?: "notes" | "brief";
}) {
  const role = state.me.role;
  const [brief, setBrief] = useState("");
  const [msgs, setMsgs] = useState<
    Record<string, { messages: { elder: string; caretaker: string; family: string }; source: string }>
  >({});
  return (
    <div className={part === "notes" ? "grid gap-6 lg:grid-cols-[1.5fr_1fr]" : "max-w-3xl space-y-6"}>
      {part === "notes" && (
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold">Check medicines for possible risks</h2>
              <p className="text-sm text-[var(--muted)]">Review possible medicine interactions and safety alerts.</p>
            </div>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    api("/api/cards/generate", {
                      method: "POST",
                      body: JSON.stringify({ context: "Weekly safety review of the current list" }),
                    }),
                  "New safety note added.",
                )
              }
            >
              Check medicines
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            The check covers{" "}
            {state.medicines.filter((m) => m.active).length > 0
              ? state.medicines
                  .filter((m) => m.active)
                  .map((m) => m.name)
                  .join(", ")
              : "no current medicines yet"}
            . It can only warn. It never starts, stops or changes a dose. No warning does not mean a combination is risk
            free, so ask a doctor or pharmacist.
          </p>
          {state.cards.length === 0 && (
            <Empty>
              No safety notes yet. Press “Check medicines” to look for anything worth asking the doctor about.
            </Empty>
          )}
          <div className="mt-3 space-y-4">
            {state.cards.map((c) => (
              <article key={c.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm uppercase tracking-wide text-amber-800">
                  {c.severity === "review_required"
                    ? "Needs a doctor's review"
                    : c.severity === "urgent_review"
                      ? "Talk to a doctor soon"
                      : "For information"}
                </p>
                <h3 className="text-lg font-semibold">{c.title}</h3>
                {c.created_at && (
                  <p className="text-xs text-[var(--muted)]">
                    Added {dayLabel(c.created_at)}, {time12(c.created_at)} IST
                  </p>
                )}
                <p className="mt-2 text-lg">
                  {role === "family" ? c.family_line_en : role === "caretaker" ? c.caretaker_line_hi : c.elder_line_hi}
                </p>
                <p className="mt-2 text-sm">
                  <strong>Tell the doctor:</strong> {c.tell_doctor}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{c.emergency_line}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{c.disclaimer}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      const u = new SpeechSynthesisUtterance(
                        role === "family"
                          ? c.family_line_en
                          : role === "caretaker"
                            ? c.caretaker_line_hi
                            : c.elder_line_hi,
                      );
                      u.lang = "en-IN";
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(u);
                    }}
                  >
                    Read aloud
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const r = await api("/api/cards/messages", {
                          method: "POST",
                          body: JSON.stringify({ cardId: c.id }),
                        });
                        setMsgs((m) => ({ ...m, [c.id]: r }));
                      })
                    }
                  >
                    Write messages for each role
                  </button>
                </div>
                {msgs[c.id] && (
                  <div className="mt-3 rounded-xl border bg-white p-3">
                    <p className="font-semibold">
                      Messages for the care circle
                      {msgs[c.id].source !== "adaption" && (
                        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs">standard wording</span>
                      )}
                    </p>
                    <p className="mt-2">
                      <strong>For {state.household.elder_name.split(" ")[0]}:</strong> {msgs[c.id].messages.elder}
                    </p>
                    <p className="mt-1">
                      <strong>For the caregiver:</strong> {msgs[c.id].messages.caretaker}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">
                      <strong>For family members:</strong> {msgs[c.id].messages.family}
                    </pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="space-y-6">
        {part === "brief" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Prepare for your next doctor visit</h2>
            <p className="text-sm text-[var(--muted)]">Review a summary of medication activity and care updates.</p>
            <button
              className="btn-primary mt-3"
              disabled={busy}
              onClick={() => act(async () => setBrief((await api("/api/brief", { method: "POST" })).brief))}
            >
              Create doctor summary
            </button>
            {brief && (
              <>
                <div className="print-memo mt-3 rounded-xl bg-stone-100 p-3">
                  <p className="print-only text-sm font-semibold uppercase tracking-[0.2em]">ApnaHaath · Doctor memo</p>
                  <p className="print-only mb-2 text-sm">
                    For {state.household.elder_name}
                    {state.household.elder_age ? `, ${state.household.elder_age}` : ""} · {state.household.city} ·
                    printed{" "}
                    {new Date().toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{brief}</pre>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
                    Print doctor memo
                  </button>
                  <ShareButtons text={brief} label="doctor memo" />
                </div>
              </>
            )}
          </section>
        )}
        {part === "notes" && role === "family" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Email reminders</h2>
            <p className="text-sm text-[var(--muted)]">
              Upcoming doses, missed doses (never skips) and appointments. Each reminder is sent once.
            </p>
            <p className="mt-1 rounded-lg bg-stone-100 px-3 py-2 text-sm">
              Reminders (upcoming dose, missed dose, appointment) are emailed to family members, and the older adult
              gets her own one-tap “I took it” link. Each is also kept in the list below with its email status.
            </p>
            <button
              className="btn-ghost mt-3"
              disabled={busy}
              onClick={() => act(() => api("/api/reminders/run", { method: "POST" }), "Reminder check finished.")}
            >
              Run reminder check now
            </button>
            {state.outbox.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">No emails yet.</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {state.outbox.map((o) => (
                <li key={o.id} className="border-b py-2">
                  <p>
                    {o.subject} → {o.to_email}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs ${o.status === "sent" ? "bg-emerald-100 text-emerald-900" : o.status === "failed" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-700"}`}
                    >
                      {o.status === "mock"
                        ? "in-app only"
                        : o.status === "sent"
                          ? "emailed"
                          : o.status === "failed"
                            ? "email failed"
                            : o.status === "pending"
                              ? "queued"
                              : o.status}
                    </span>{" "}
                    <span className="text-xs text-[var(--muted)]">
                      {dayLabel(o.created_at)} {time12(o.created_at)}
                    </span>
                  </p>
                  {o.body && (
                    <div className="mt-1">
                      <ShareButtons text={`${o.subject}\n\n${o.body}`} label="reminder" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
