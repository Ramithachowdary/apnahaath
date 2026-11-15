"use client";

/** Care circle tab: members, roles and one-time invites (copy / share / WhatsApp). */
import { useState } from "react";
import type { Role, State, ActFn } from "./types";
import { ROLE_LABEL } from "./constants";
import { api } from "./helpers";
import { Empty, ShareButtons } from "./ui";

export function Circle({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const [last, setLast] = useState<{ code: string; link: string; role: Role; expiresAt: string } | null>(null);
  const hasElder = state.members.some((m) => m.role === "elder");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">People in this care circle</h2>
        <p className="text-[var(--muted)]">
          {state.household.elder_name}
          {state.household.elder_age ? `, ${state.household.elder_age}` : ""} · {state.household.city} · prefers{" "}
          {state.household.language}
        </p>
        <ul className="mt-3 space-y-2">
          {state.members.map((m) => (
            <li key={m.id} className="rounded-xl border bg-white px-3 py-2">
              <strong>{m.name}</strong> — {ROLE_LABEL[m.role]}
            </li>
          ))}
        </ul>
        {!hasElder && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            Next step: invite the elder so she can accept medicines and confirm doses.
          </p>
        )}
      </section>
      {state.me.isOwner ? (
        <section className="panel">
          <h2 className="text-2xl font-semibold">Invite someone</h2>
          <p className="text-sm text-[var(--muted)]">
            Each code works once and expires in 48 hours. Share it privately.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["elder", "caretaker", "family"] as Role[]).map((r) => (
              <button
                key={r}
                className="btn-ghost"
                disabled={busy || (r === "elder" && hasElder)}
                onClick={() =>
                  act(async () =>
                    setLast(await api("/api/invites", { method: "POST", body: JSON.stringify({ role: r }) })),
                  )
                }
              >
                Invite {ROLE_LABEL[r].toLowerCase()}
              </button>
            ))}
          </div>
          {last && (
            <div className="mt-4 rounded-xl border-2 border-[var(--brand)] bg-white p-4">
              <p>
                Invite code for <strong>{ROLE_LABEL[last.role]}</strong> (shown only once):
              </p>
              <p className="my-2 font-mono text-3xl tracking-widest">{last.code}</p>
              <p className="break-all text-sm">Link: {last.link}</p>
              <div className="mt-2">
                <ShareButtons
                  text={`You're invited to ${state.household.elder_name}'s care circle on ApnaHaath as ${ROLE_LABEL[last.role]}. Open ${last.link} (code ${last.code}, works once, expires in 48 hours).`}
                  label="invite"
                />
              </div>
            </div>
          )}
          <h3 className="mt-4 font-semibold">Recent invites</h3>
          {state.invites.length === 0 && <p className="text-sm text-[var(--muted)]">None yet.</p>}
          <ul className="text-sm">
            {state.invites.map((i) => (
              <li key={i.id} className="border-b py-1">
                {ROLE_LABEL[i.role]} ·{" "}
                {i.used_by ? "used" : Date.parse(i.expires_at) < Date.now() ? "expired" : "waiting"}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel">
          <Empty>Only the person who created this care circle can invite others.</Empty>
        </section>
      )}
    </div>
  );
}
