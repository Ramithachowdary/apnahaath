"use client";

import { useState } from "react";
import { HandHeart, Menu, X } from "lucide-react";
import { LanguageSelect, useT } from "../app/lang";
import { NAV } from "./content";

/** Sticky header: logo, section links, language, sign-in and a compact menu below 1024px. */
export function LandingHeader({ signupHref, signinHref }: { signupHref: string; signinHref: string }) {
  const { tr } = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <a href="#top" className="flex items-center gap-2 text-lg font-bold text-[var(--brand)]">
          <HandHeart size={24} aria-hidden="true" /> ApnaHaath
        </a>
        <nav
          aria-label="Page sections"
          className="hidden items-center gap-6 whitespace-nowrap text-[15px] font-medium lg:flex"
        >
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[var(--muted)] hover:text-[var(--ink)]">
              {tr(n.key)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSelect className="hidden sm:flex" />
          <span className="hidden sm:block">
            <a className="btn-ghost whitespace-nowrap" href={signinHref}>
              {tr("landing.signIn")}
            </a>
          </span>
          <a className="btn-primary whitespace-nowrap px-4" href={signupHref}>
            {tr("landing.getStarted")}
          </a>
          <button
            type="button"
            className="btn-ghost px-3 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-menu" aria-label="Menu" className="border-t border-stone-200 bg-white lg:hidden">
          <ul className="mx-auto grid max-w-6xl px-5 py-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="flex items-center py-3 text-lg font-medium"
                  style={{ minHeight: 44 }}
                  onClick={() => setMenuOpen(false)}
                >
                  {tr(n.key)}
                </a>
              </li>
            ))}
            <li className="py-2">
              <LanguageSelect />
            </li>
            <li>
              <a
                href={signinHref}
                className="flex items-center py-3 text-lg font-semibold text-[var(--brand)]"
                style={{ minHeight: 44 }}
                onClick={() => setMenuOpen(false)}
              >
                {tr("landing.signIn")}
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
