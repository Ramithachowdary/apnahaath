"use client";

/** History tab: last 7 days, the weekly AI summary and the append-only event log. */
import { useState } from "react";
import type { Slot, State, ActFn } from "./types";
import { EVENT_LABEL } from "./constants";
import { api, time12, dayLabel } from "./helpers";
import { StatusChip, Empty, ShareButtons } from "./ui";

type Weekly = {
  summary: { elder: string; caretaker: string; family: string };
  source: string;
  disclaimer: string;
  stats: { rate: number | null; confirmed: number; missed: number; skipped: number; witnessed: number };
};

export function WeeklySummary({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const [w, setW] = useState<Weekly | null>(null);
  const role = state.me.role;
  const text = w
    ? role === "family"
      ? w.summary.family
      : role === "caretaker"
        ? w.summary.caretaker
        : w.summary.elder
    : "";
  return (
    <section className="panel mb-6" aria-labelledby="weekly-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="weekly-h" className="text-2xl font-semibold">
          This week, in plain words
        </h2>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => act(async () => setW((await api("/api/summary/weekly", { method: "POST" })) as Weekly))}
        >
          {w ? "Refresh weekly summary" : "Get weekly care summary (AI)"}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Numbers come from the log. Adaption only words them for {role === "elder" ? "you" : `the ${role}`}; it can never
        change a medicine.
      </p>
      {w && (
        <div className="mt-3">
          <p className="mb-2 text-sm">
            <span className="rounded-full bg-stone-100 px-2 py-0.5">
              source: {w.source === "adaption" ? "Adaption" : "template fallback"}
            </span>{" "}
            {w.stats.rate !== null && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">
                Elder-confirmation rate {w.stats.rate}%
              </span>
            )}
          </p>
          <p className={`whitespace-pre-line ${role === "elder" ? "text-2xl leading-relaxed" : "text-lg"}`}>{text}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">{w.disclaimer}</p>
          <div className="mt-3">
            <ShareButtons text={`ApnaHaath weekly summary\n\n${text}\n\n${w.disclaimer}`} label="weekly summary" />
          </div>
        </div>
      )}
    </section>
  );
}

function lastSevenIstDays(): string[] {
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: 7 }, (_, i) => new Date(base - i * 86_400_000).toISOString().slice(0, 10));
}

export function History({ state }: { state: State }) {
  const byDay = new Map<string, Slot[]>(lastSevenIstDays().map((d) => [d, [] as Slot[]]));
  for (const s of state.history) {
    const d = s.scheduled_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Last 7 days</h2>
        <p className="text-sm text-[var(--muted)]">
          Days before the care circle started, or with no medicines due, show as “no doses”.
        </p>
        {[...byDay.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([day, slots]) => (
            <div key={day} className="mt-4">
              <h3 className="font-semibold">{dayLabel(day)}</h3>
              {slots.length === 0 && (
                <p className="mt-1 rounded-lg border border-dashed bg-white/60 px-3 py-2 text-[var(--muted)]">
                  No doses
                </p>
              )}
              <ul className="mt-1 grid gap-1">
                {slots
                  .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                      <span>
                        {time12(s.scheduled_at)} · {s.medicine_name}
                      </span>
                      <StatusChip status={s.status} extra={s.skip_reason} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
      </section>
      <section className="panel">
        <h2 className="text-2xl font-semibold">Who did what</h2>
        <p className="text-sm text-[var(--muted)]">Every entry is kept. Nothing is edited or deleted.</p>
        {state.events.length === 0 && (
          <Empty>
            Nothing logged yet. When the elder taps &ldquo;Yes, I took it&rdquo; or a caretaker witnesses a dose, it
            appears here with the name and time.
          </Empty>
        )}
        <ul className="mt-3 space-y-2">
          {state.events.map((e) => (
            <li key={e.id} className="border-b pb-2">
              <span className="text-sm text-[var(--muted)]">
                {dayLabel(e.created_at)} {time12(e.created_at)}
              </span>
              <br />
              <strong>{e.actor_name}</strong> {EVENT_LABEL[e.type] ?? e.type}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
