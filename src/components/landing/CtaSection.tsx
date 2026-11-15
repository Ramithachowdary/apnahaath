"use client";

import { ArrowRight } from "lucide-react";
import { useT } from "../app/lang";

/** Closing call to action. */
export function CtaSection({ signupHref }: { signupHref: string }) {
  const { tr } = useT();
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-[var(--brand)] p-8 text-white md:flex-row md:items-center md:p-10">
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{tr("landing.ctaTitle")}</h2>
          <p className="mt-2 text-lg text-emerald-50">{tr("landing.ctaText")}</p>
        </div>
        <a className="btn shrink-0 bg-white px-6 text-lg text-[var(--brand)] hover:bg-emerald-50" href={signupHref}>
          {tr("landing.start")} <ArrowRight size={20} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
