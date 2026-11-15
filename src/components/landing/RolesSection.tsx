"use client";

import { CheckCircle2 } from "lucide-react";
import { ROLES, COMPARE } from "./content";

/** What each role can do, and how ApnaHaath compares. */
export function RolesSection() {
  return (
    <section id="roles" className="scroll-mt-20 border-y border-stone-200 bg-white py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl font-bold tracking-tight">One log, three clear roles</h2>
        <p className="mt-2 text-lg text-[var(--muted)]">
          The older adult decides. The caregiver helps. The family stays informed.
        </p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 md:grid-cols-3">
          {ROLES.map((r) => (
            <article key={r.who} className="bg-white p-6">
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--brand-2)]">
                <r.icon size={18} aria-hidden="true" /> {r.who}
              </p>
              <h3 className="mt-2 text-xl font-bold">{r.title}</h3>
              <ul className="mt-3 space-y-2">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2 text-[var(--muted)]">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ok)]" aria-hidden="true" /> {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <h3 className="mt-14 text-2xl font-bold tracking-tight">Why not just a reminder app?</h3>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          A reminder says when to take a medicine. It cannot tell the family whether it was taken, or who gave it.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">ApnaHaath compared with pill reminder apps and WhatsApp groups</caption>
            <thead className="bg-stone-50 text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What matters
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-[var(--brand)]">
                  ApnaHaath
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Pill reminder apps
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  WhatsApp group
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.feature} className="border-t border-stone-200">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {r.feature}
                  </th>
                  <td className="px-4 py-3 font-semibold text-[var(--brand)]">{r.us}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.reminder}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.whatsapp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
