"use client";

import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { SIGNIN_HREF, SIGNUP_HREF } from "./landing/content";
import { LandingHeader } from "./landing/LandingHeader";
import { Hero } from "./landing/Hero";
import { WhySection } from "./landing/WhySection";
import { HowSection } from "./landing/HowSection";
import { RolesSection } from "./landing/RolesSection";
import { ChecksSection } from "./landing/ChecksSection";
import { TrustSection } from "./landing/TrustSection";
import { CtaSection } from "./landing/CtaSection";
import { FaqSection } from "./landing/FaqSection";

/** Read an invite code from the address bar so the sign-up links carry it forward. */
function useInviteFromUrl(initial: string) {
  const [invite, setInvite] = useState(initial);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) setInvite(code);
  }, []);
  return invite;
}

/** Public landing page. Server-rendered and static; sections live in ./landing. */
export default function Landing({
  invite: initialInvite = "",
  toggles,
}: {
  invite?: string;
  toggles?: React.ReactNode;
}) {
  const invite = useInviteFromUrl(initialInvite);
  const q = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  const signupHref = SIGNUP_HREF + q;
  const signinHref = SIGNIN_HREF + q;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <LandingHeader signupHref={signupHref} signinHref={signinHref} />
      <main id="top">
        <Hero signupHref={signupHref} signinHref={signinHref} />
        <WhySection />
        <HowSection />
        <RolesSection />
        <ChecksSection />
        <TrustSection />
        <CtaSection signupHref={signupHref} />
        <FaqSection />
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 font-bold text-[var(--brand)]">
              <HandHeart size={20} aria-hidden="true" /> ApnaHaath
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">A care record for families. Not a medical device.</p>
          </div>
          {toggles}
        </div>
      </footer>
    </div>
  );
}
