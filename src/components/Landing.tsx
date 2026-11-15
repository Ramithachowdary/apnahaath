"use client";

import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  HandHeart,
  LockKeyhole,
  Menu,
  Phone,
  Pill,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { LanguageSelect, useT } from "./app/lang";

/** Where the landing page CTAs send people. */
const SIGNUP_HREF = "/signup";
const SIGNIN_HREF = "/signin";

const NAV = [
  { href: "#how", key: "landing.how" },
  { href: "#roles", key: "landing.families" },
  { href: "#safety", key: "landing.ai" },
  { href: "#faq", key: "landing.faq" },
] as const;

const HERO_POINTS = [
  { icon: HandHeart, text: "The older adult confirms their own medicines." },
  { icon: Eye, text: "Caregivers record doses they see being taken." },
  { icon: BellRing, text: "Family members get reminders and updates." },
  { icon: ShieldCheck, text: "Safety checks can flag possible medicine risks." },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Create a care circle",
    text: "Create an account and add the older adult's profile.",
  },
  {
    icon: Users,
    title: "Invite family and caregivers",
    text: "Invite the people who help with daily care.",
  },
  {
    icon: Pill,
    title: "Add medicines and appointments",
    text: "Set up the schedule. The older adult reviews changes and confirms each dose.",
  },
];

const ROLES = [
  {
    icon: HandHeart,
    who: "Older adult",
    title: "You stay in control",
    points: ["Confirm your own medicines.", "Skip a dose with a reason.", "Accept or reject suggested changes."],
  },
  {
    icon: Eye,
    who: "Caregiver",
    title: "Help with daily care",
    points: [
      "Record medicines you personally witness.",
      "View today's medication schedule.",
      "Help maintain the daily routine.",
    ],
  },
  {
    icon: Users,
    who: "Family",
    title: "Stay informed",
    points: ["Track medication updates.", "Receive reminders.", "Help manage appointments and care schedules."],
  },
];

const CHECKS = [
  {
    icon: ShieldCheck,
    title: "Medicine safety checks",
    text: "The system can flag possible medicine interactions for review.",
  },
  {
    icon: Users,
    title: "Clear family updates",
    text: "Each person receives information relevant to their role.",
  },
  {
    icon: FileText,
    title: "Weekly care summary",
    text: "See medication activity and missed confirmations for the week.",
  },
];

const TRUST = [
  { icon: Users, text: "Only invited members can see the care circle." },
  { icon: ClipboardList, text: "Every action is recorded under the person's name." },
  { icon: HandHeart, text: "Only the older adult can confirm their own dose." },
  { icon: LockKeyhole, text: "Reminder emails don't show medicine names in the subject." },
];

const FACTS = [
  "Many older adults take several medicines every day.",
  "Often more than one person helps: family, a caregiver, a neighbour.",
  "Without one shared record, it is hard to know who gave what, and when.",
];

const COMPARE: { feature: string; us: string; reminder: string; whatsapp: string }[] = [
  { feature: "The older adult confirms each dose", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Caregiver doses recorded as witnessed", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "A record nobody can quietly edit", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "One-page summary for the doctor", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Whole family sees the same record", us: "Yes", reminder: "No", whatsapp: "Partly, in chat" },
];

const FAQ = [
  {
    q: "Who can mark a dose as taken?",
    a: "Only the older adult, from their own account. When a caregiver records a dose, it is saved as witnessed, not as taken.",
  },
  {
    q: "Can the app change a prescription?",
    a: "No. Safety checks can only warn. Anything that tries to start, stop or change a medicine is blocked. Medicine decisions stay with the doctor.",
  },
  {
    q: "Who gets the reminder emails?",
    a: "Family members get reminders for upcoming doses, missed doses and appointments. The older adult can also get a one-tap link to confirm a dose. A skipped dose is never reported as missed.",
  },
  {
    q: "Is my family's information private?",
    a: "Yes. Each care circle is separate, and only invited members can see it. Passwords are never stored in plain text.",
  },
  {
    q: "Is ApnaHaath a medical device?",
    a: "No. It is a care record, not a doctor. In an emergency, call 108 or go to the nearest hospital.",
  },
];

function Mockup() {
  const rows = [
    {
      name: "Thyronorm 50",
      time: "6:30 AM",
      chip: "Confirmed",
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      Icon: CheckCircle2,
    },
    {
      name: "Telma 40",
      time: "8:00 AM",
      chip: "Witnessed",
      cls: "bg-sky-50 text-sky-800 ring-sky-200",
      Icon: Eye,
    },
    {
      name: "Shelcal 500",
      time: "4:00 PM",
      chip: "Skipped",
      cls: "bg-amber-50 text-amber-900 ring-amber-200",
      Icon: CalendarClock,
    },
  ];
  return (
    <figure className="relative mx-auto w-full max-w-[560px] xl:h-[600px] xl:max-w-[600px]">
      <figcaption className="sr-only">
        Example screens: the older adult&apos;s medicine confirmation, a safety alert and a weekly family summary.
      </figcaption>
      {/* phone: older adult's view */}
      <div
        aria-hidden="true"
        className="mx-auto w-[280px] max-w-full rounded-[2.25rem] border-[9px] border-stone-900 bg-white p-4 shadow-[0_24px_60px_-24px_rgba(15,92,76,0.45)] xl:absolute xl:left-[160px] xl:top-0"
      >
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-stone-200" />
        <p className="text-sm font-semibold text-[var(--muted)]">Namaste, Amma</p>
        <p className="text-xl font-bold">Glycomet 500</p>
        <p className="text-[var(--muted)]">1:30 PM, with lunch</p>
        <div className="mt-4 grid place-items-center rounded-2xl bg-[var(--brand)] py-6 text-xl font-bold text-white">
          <Pill size={30} className="mb-1" /> Yes, I took it
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
          <div className="rounded-xl border border-stone-200 py-3">Skip</div>
          <div className="rounded-xl border border-stone-200 py-3">Later</div>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-[var(--muted)]">{r.time}</p>
              </div>
              <span className={`chip shrink-0 whitespace-nowrap px-2 py-0.5 text-xs ${r.cls}`}>
                <r.Icon size={13} /> {r.chip}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-[560px] gap-3 sm:grid-cols-2 xl:mt-0 xl:contents">
        {/* safety alert */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm xl:absolute xl:left-0 xl:top-28 xl:w-[170px] xl:shadow-lg">
          <p className="flex items-center gap-1.5 font-bold">
            <ShieldCheck size={16} aria-hidden="true" /> Medicine safety alert
          </p>
          <p className="mt-1">Possible interaction detected. Ask a doctor or pharmacist to review it.</p>
        </div>
        {/* family adherence summary */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm xl:absolute xl:bottom-12 xl:right-0 xl:w-[175px] xl:shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Example screen · Family</p>
          <p className="mt-2 text-lg font-bold leading-tight">6 of 7 doses confirmed</p>
          <p className="text-3xl font-bold text-[var(--brand)]">86%</p>
          <p className="text-sm text-[var(--muted)]">Confirmed by Amma this week</p>
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {[1, 1, 1, 0, 1, 1, 1].map((v, i) => (
              <span key={i} className={`h-6 flex-1 rounded ${v ? "bg-[#0f766e]" : "bg-amber-500"}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">Mon to Sun</p>
        </div>
      </div>
    </figure>
  );
}

export default function Landing({ invite = "", toggles }: { invite?: string; toggles?: React.ReactNode }) {
  const { tr } = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const q = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  const signupHref = SIGNUP_HREF + q;
  const signinHref = SIGNIN_HREF + q;

  return (
    <div className="min-h-screen overflow-x-hidden">
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

      <main id="top">
        <section className="border-b border-stone-200 bg-gradient-to-b from-[var(--soft)] to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:pt-16 lg:grid-cols-2 xl:grid-cols-[1fr_600px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">{tr("landing.badge")}</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                {tr("landing.hero1")}
              </h1>
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
