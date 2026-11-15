"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useT } from "../app/lang";
import { HERO_POINTS } from "./content";
import { Mockup } from "./Mockup";

/** Hero: headline, the three role promises and the example screens. */
export function Hero({ signupHref, signinHref }: { signupHref: string; signinHref: string }) {
  const { tr } = useT();
  return (
    <section className="border-b border-stone-200 bg-gradient-to-b from-[var(--soft)] to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:pt-16 lg:grid-cols-2 xl:grid-cols-[1fr_600px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">{tr("landing.badge")}</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">{tr("landing.hero1")}</h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">{tr("landing.heroText")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn-primary px-6 text-lg" href={signupHref}>
              {tr("landing.start")} <ArrowRight size={20} aria-hidden="true" />
            </a>
            <a className="btn-ghost px-6 text-lg" href={signinHref}>
              {tr("landing.signIn")}
            </a>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {HERO_POINTS.map((p) => (
              <li key={p.text} className="flex gap-2 text-[var(--ink)]">
                <p.icon size={20} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                {p.text}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={16} className="text-[var(--ok)]" aria-hidden="true" /> {tr("landing.free")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={16} className="text-[var(--ok)]" aria-hidden="true" /> {tr("landing.anyPhone")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={16} className="text-[var(--ok)]" aria-hidden="true" /> {tr("landing.aiNever")}
            </span>
          </p>
        </div>
        <Mockup />
      </div>
    </section>
  );
}
