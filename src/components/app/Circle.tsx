"use client";

/** Care circle: whose circle this is, each member's role and permissions, and one-time invites (owner only). */
import { useState } from "react";
import { Crown, UserPlus } from "lucide-react";
import type { Role, State, ActFn, View } from "./types";
import { ROLE_LABEL } from "./constants";
import { api } from "./helpers";
import { ShareButtons } from "./ui";

/** One line per role that matches the server rules (src/lib/rules.ts). */
const ROLE_CAN: Record<Role, string> = {
  elder: "Person receiving care. Confirms or skips their own doses and accepts or rejects suggested changes.",
  caretaker: "Records doses they personally witnessed. A witnessed dose is never counted as taken.",
  family: "Sees care updates, suggests medicine changes and manages appointments. The older adult decides.",
};

const ROLE_BADGE: Record<Role, string> = {
  elder: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  caretaker: "bg-sky-50 text-sky-900 ring-sky-200",
  family: "bg-stone-100 text-stone-800 ring-stone-200",
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export function Circle({ state, busy, act }: { state: State; busy: boolean; act: ActFn; go?: (v: View) => void }) {
  const [last, setLast] = useState<{ code: string; link: string; role: Role; expiresAt: string } | null>(null);
  const hasElder = state.members.some((m) => m.role === "elder");
  const order: Record<Role, number> = { elder: 0, caretaker: 1, family: 2 };
  const members = [...state.members].sort((x, y) => order[x.role] - order[y.role]);
  const ownerName = state.me.isOwner ? state.me.name : null;
  const h = state.household;
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--soft)] p-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Person receiving care</p>
        <p className="mt-1 text-2xl font-bold">
          {h.elder_name}
          {h.elder_age ? <span className="font-normal text-[var(--muted)]">, {h.elder_age}</span> : null}
        </p>
        <p className="text-[var(--muted)]">
          {h.city} · Prefers {h.language} · {state.members.length} {state.members.length === 1 ? "member" : "members"}
        </p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel" aria-labelledby="members-h">
          <h2 id="members-h" className="text-xl font-semibold">
            Members
          </h2>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {members.map((m) => {
              const isMe = m.id === state.me.id;
              const isOwner = isMe && state.me.isOwner;
              return (
                <li key={m.id} className="flex items-start gap-3 py-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--soft)] font-bold text-[var(--brand)]"
                    aria-hidden="true"
                  >
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <strong className="text-lg">{m.name}</strong>
                      <span className={`chip ${ROLE_BADGE[m.role]}`}>{ROLE_LABEL[m.role]}</span>
                      {isOwner && (
                        <span className="chip bg-amber-50 text-amber-900 ring-amber-200">
                          <Crown size={14} aria-hidden="true" /> Created this circle
                        </span>
                      )}
                      {isMe && <span className="text-sm font-semibold text-[var(--brand)]">(You)</span>}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{ROLE_CAN[m.role]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {!hasElder && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              Next step: invite {h.elder_name} as the older adult, so they can accept medicines and confirm doses.
            </p>
          )}
        </section>
        {state.me.isOwner ? (
          <section className="panel">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <UserPlus size={20} aria-hidden="true" /> Invite member
            </h2>
            <p className="text-sm text-[var(--muted)]">
              You created this care circle, so you can invite family members and caregivers. Each code works once and
              expires in 48 hours. Share it privately.
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
                  {r === "elder" && hasElder ? "Older adult already joined" : `Invite ${ROLE_LABEL[r].toLowerCase()}`}
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
                  {i.used_by ? "Joined" : Date.parse(i.expires_at) < Date.now() ? "Expired" : "Waiting to be used"}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <UserPlus size={20} aria-hidden="true" /> Invites
            </h2>
            <p className="mt-2 text-[var(--muted)]">
              {ownerName
                ? `Only ${ownerName}, who created this circle, can invite members.`
                : "Only the person who created this circle can invite members. Ask them to send an invite code."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
