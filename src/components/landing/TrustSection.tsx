"use client";

import { Phone } from "lucide-react";
import { TRUST } from "./content";

/** Privacy and emergency guidance. */
export function TrustSection() {
  return (
    <section id="safety" className="scroll-mt-20 border-y border-stone-200 bg-white py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Your family&apos;s information stays protected</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {TRUST.map((t) => (
              <li key={t.text} className="flex gap-3">
                <t.icon size={20} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            ApnaHaath is a care record. It is not a doctor or a medical device.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="flex items-center gap-2 text-lg font-bold text-[var(--danger)]">
            <Phone size={20} aria-hidden="true" /> In an emergency
          </p>
          <p className="mt-1 text-red-900">Call an ambulance or go to the nearest hospital.</p>
          <a
            href="tel:108"
            className="btn mt-4 bg-[var(--danger)] px-5 text-lg text-white hover:opacity-90"
            aria-label="Call 108 for an ambulance"
          >
            <Phone size={18} aria-hidden="true" /> Call 108
          </a>
        </div>
      </div>
    </section>
  );
}
