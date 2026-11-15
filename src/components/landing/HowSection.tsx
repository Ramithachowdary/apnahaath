"use client";

import { STEPS } from "./content";

/** Three setup steps. */
export function HowSection() {
  return (
    <section id="how" className="scroll-mt-20 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <p className="mt-2 text-lg text-[var(--muted)]">Three steps. No app store, no extra device.</p>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand)] font-bold text-white"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">Step {i + 1}</p>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-[var(--muted)]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
