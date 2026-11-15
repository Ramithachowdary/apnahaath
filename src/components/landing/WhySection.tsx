"use client";

import { FACTS } from "./content";

/** Why a shared record matters. */
export function WhySection() {
  return (
    <section aria-labelledby="why-title" className="border-b border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-[1fr_2fr] md:items-start">
        <h2 id="why-title" className="text-xl font-bold">
          Why families use ApnaHaath
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {FACTS.map((f) => (
            <li key={f} className="border-l-2 border-[var(--brand)] pl-3 text-[var(--ink)]">
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
