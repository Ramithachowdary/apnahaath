"use client";

import { useT } from "../app/lang";
import { FAQ } from "./content";

/** Frequently asked questions as native disclosure widgets. */
export function FaqSection() {
  const { tr } = useT();
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16">
      <h2 className="text-3xl font-bold tracking-tight">{tr("landing.faqTitle")}</h2>
      <div className="mt-8 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-5 py-2">
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-semibold"
              style={{ minHeight: 44 }}
            >
              {f.q}
              <span
                className="text-2xl leading-none text-[var(--brand)] transition group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="pb-4 text-[var(--muted)]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
