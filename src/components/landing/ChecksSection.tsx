"use client";

import { CHECKS } from "./content";

/** Safety checks and summaries. */
export function ChecksSection() {
  return (
    <section id="ai" aria-labelledby="checks-title" className="scroll-mt-20 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 id="checks-title" className="text-3xl font-bold tracking-tight">
          Safety checks that only warn
        </h2>
        <p className="mt-2 max-w-2xl text-lg text-[var(--muted)]">
          AI can flag possible risks. It never prescribes, starts, stops or changes a dose. Always ask a doctor or
          pharmacist.
        </p>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {CHECKS.map((c) => (
            <div key={c.title}>
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--soft)] text-[var(--brand)]">
                <c.icon size={22} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl font-bold">{c.title}</h3>
              <p className="mt-1 text-[var(--muted)]">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
