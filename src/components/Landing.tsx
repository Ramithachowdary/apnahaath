"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  HandHeart,
  LockKeyhole,
  Mail,
  MessageCircleHeart,
  Phone,
  Pill,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { LanguageSelect, useT } from "./app/lang";

type AuthFn = (
  path: string,
  body: Record<string, string>,
  okText?: string,
) => Promise<Record<string, unknown> & { ok: boolean }>;

const STEPS = [
  {
    icon: UserPlus,
    title: "Create a care circle",
    text: "Sign up, add your elder's name and choose your role. Every change is saved under your own account.",
  },
  {
    icon: Users,
    title: "Invite the people who help",
    text: "Send one-time invite links to the elder, the caretaker and family — by copy, share or WhatsApp.",
  },
  {
    icon: Pill,
    title: "Add medicines, she decides",
    text: "Family suggests medicines and times; the elder accepts. Then she marks each dose herself.",
  },
];

const ROLES = [
  {
    icon: HandHeart,
    who: "Elder",
    title: "In charge of her own medicines",
    points: [
      "Big, simple “Yes, I took it” buttons",
      "Skip with a reason — never counted as missed",
      "Accepts or declines every suggested change",
    ],
  },
  {
    icon: Eye,
    who: "Caretaker",
    title: "Witness, not author",
    points: [
      "“I saw her take it” is recorded separately",
      "Can never mark a dose as taken",
      "Today's list at a glance",
    ],
  },
  {
    icon: Users,
    who: "Family",
    title: "Peace of mind from anywhere",
    points: [
      "Email reminders for upcoming and missed doses",
      "Appointments and a printable doctor memo",
      "Suggest changes — nothing changes until she says yes",
    ],
  },
];

const AI = [
  {
    icon: ShieldCheck,
    title: "Gemini safety check",
    text: "Google Gemini reads the medicine list and the log and warns about risks — like a self-taken painkiller next to a blood thinner. It can only warn: any answer that tries to change a dose is thrown away in code.",
  },
  {
    icon: MessageCircleHeart,
    title: "Care messages by Adaption",
    text: "One safety note becomes three kind, role-specific messages — for the elder, the caretaker and the family — with the same no-dose-change guard.",
  },
  {
    icon: Sparkles,
    title: "Weekly summary in plain words",
    text: "Numbers are counted in code from the log; AI only words them. Copy it to the family WhatsApp group in one tap.",
  },
];

const FAQ = [
  {
    q: "Who can mark a dose as taken?",
    a: "Only the elder, from her own account. A caretaker's tap is saved as a witness and never counts as taken.",
  },
  {
    q: "Can the AI change a prescription?",
    a: "No. AI output is checked in code and rejected if it tries to start, stop or change any medicine. Only the elder accepts changes, and medicine decisions belong with her doctor.",
  },
  {
    q: "Who gets the reminder emails?",
    a: "Family members get upcoming, missed-dose and appointment reminders. The elder can also get her own one-tap “I took it” link. Skips are never reported as missed.",
  },
  {
    q: "Is my family's data private?",
    a: "Each care circle is isolated. Passwords are stored only as secure hashes, and every request is checked against your role in that circle.",
  },
  {
    q: "Is ApnaHaath a medical device?",
    a: "No. It is a care log and a safety net, not a doctor. In an emergency call 108 or go to the nearest hospital.",
  },
];

const OUTCOMES = [
  {
    title: "Know every dose was taken, by her, on time",
    text: "Only the elder's own account can mark a dose taken. A caretaker's tap is saved as a witness, never as taken.",
  },
  {
    title: "One shared record for family, caretaker and doctor",
    text: "Doses, skips, appointments and changes in one append-only log, with a one-page brief for the doctor.",
  },
  {
    title: "A safety check before a new medicine",
    text: "Before a new tablet goes in, ApnaHaath flags known clashes with what she already takes. It warns; it never changes a dose.",
  },
];

const COMPARE: { feature: string; us: string; reminder: string; whatsapp: string }[] = [
  { feature: "Dose confirmed by the elder herself", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Caretaker logged as witness, not as taken", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "Append-only log nobody can quietly edit", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "One-page brief for the doctor", us: "Yes", reminder: "No", whatsapp: "No" },
  { feature: "AI that can never change a dose", us: "Yes", reminder: "Not applicable", whatsapp: "No" },
  { feature: "Family sees the same record", us: "Yes", reminder: "No", whatsapp: "Partly, in chat" },
];

function Mockup() {
  const rows = [
    {
      name: "Thyronorm 50",
      time: "6:30 AM",
      chip: "Confirmed by Amma",
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      Icon: CheckCircle2,
    },
    { name: "Telma 40", time: "8:00 AM", chip: "Witnessed", cls: "bg-sky-50 text-sky-800 ring-sky-200", Icon: Eye },
    {
      name: "Shelcal 500",
      time: "4:00 PM",
      chip: "Skipped · fasting",
      cls: "bg-amber-50 text-amber-900 ring-amber-200",
      Icon: CalendarClock,
    },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto h-[600px] w-full max-w-[300px] sm:max-w-lg">
      {/* phone: elder view */}
      <div className="absolute left-0 top-0 w-[290px] rounded-[2.5rem] border-[10px] border-stone-900 bg-white p-4 shadow-[0_30px_80px_-20px_rgba(15,92,76,0.45)]">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-stone-200" />
        <p className="text-sm font-semibold text-[var(--muted)]">Namaste, Amma</p>
        <p className="text-xl font-extrabold">Glycomet 500</p>
        <p className="text-[var(--muted)]">1:30 PM · with lunch</p>
        <div className="mt-4 grid place-items-center rounded-3xl bg-[var(--brand)] py-7 text-2xl font-extrabold text-white shadow-lg">
          <Pill size={34} className="mb-1" /> Yes, I took it
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
          <div className="rounded-2xl border border-stone-200 py-3">Not now</div>
          <div className="rounded-2xl border border-stone-200 py-3">Later</div>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-[var(--muted)]">{r.time}</p>
              </div>
              <span className={`chip px-2 py-0.5 text-xs ${r.cls}`}>
                <r.Icon size={13} /> {r.chip}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* family card */}
      <div className="absolute bottom-4 right-0 hidden w-[200px] rounded-2xl sm:block border border-stone-200 bg-white p-4 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Family view · Priya</p>
        <p className="mt-2 text-4xl font-extrabold text-[var(--brand)]">93%</p>
        <p className="font-semibold">confirmed by Amma this week</p>
        <div className="mt-3 flex gap-1">
          {[1, 1, 1, 0.6, 1, 1, 1].map((v, i) => (
            <span
              key={i}
              className="h-8 flex-1 rounded-md"
              style={{ background: v === 1 ? "#0f766e" : "#f59e0b", opacity: v === 1 ? 0.85 : 1 }}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Mon – Sun</p>
      </div>
      {/* AI nudge */}
      <div className="absolute right-0 top-12 hidden w-[200px] rounded-2xl sm:block border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg">
        <p className="flex items-center gap-1 font-bold">
          <ShieldCheck size={16} /> Gemini safety check
        </p>
        <p className="mt-1">
          Brufen with Ecosprin may raise bleeding risk. Ask the doctor on Thursday. Nothing was changed.
        </p>
      </div>
    </div>
  );
}

export default function Landing({
  busy,
  onAuth,
  invite,
  toggles,
  googleEnabled = false,
}: {
  busy: boolean;
  onAuth: AuthFn;
  invite: string;
  toggles?: React.ReactNode;
  googleEnabled?: boolean;
}) {
  const { tr } = useT();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyFor, setVerifyFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function submit() {
    if (mode === "signup") {
      const r = await onAuth("/api/auth/signup", { name, email, password });
      if (r.needsVerification) {
        setVerifyFor(String(r.email || email));
        setCooldown(Number(r.retryAfterS) || 60);
        setCode("");
      }
    } else {
      const r = await onAuth("/api/auth/login", { email, password });
      if (r.needsVerification) {
        setVerifyFor(String(r.email || email));
        setCode("");
      }
    }
  }
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="flex items-center gap-2 text-lg font-bold text-[var(--brand)]">
            <HandHeart size={24} /> ApnaHaath
          </a>
          <nav
            aria-label="Page sections"
            className="hidden items-center gap-6 text-[15px] font-medium text-[var(--muted)] md:flex"
          >
            <a href="#how" className="hover:text-[var(--ink)]">
              {tr("landing.how")}
            </a>
            <a href="#roles" className="hover:text-[var(--ink)]">
              {tr("landing.families")}
            </a>
            <a href="#ai" className="hover:text-[var(--ink)]">
              {tr("landing.ai")}
            </a>
            <a href="#faq" className="hover:text-[var(--ink)]">
              {tr("landing.faq")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <span className="hidden sm:block">
              <a className="btn-ghost" href="#account" onClick={() => setMode("login")}>
                {tr("landing.signIn")}
              </a>
            </span>
            <a className="btn-primary whitespace-nowrap px-4" href="#account" onClick={() => setMode("signup")}>
              {tr("landing.getStarted")}
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <div className="bg-[radial-gradient(ellipse_at_top_left,rgba(15,118,110,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(217,119,6,0.14),transparent_50%)]">
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.1fr_1fr] md:pt-20">
            <div>
              <p className="chip bg-white/80 text-[var(--brand)] ring-emerald-200">
                <HandHeart size={15} /> {tr("landing.badge")}
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] md:text-6xl">
                {tr("landing.hero1")}
                <span className="block bg-gradient-to-r from-[#0f766e] to-[#b45309] bg-clip-text text-transparent">
                  {tr("landing.hero2")}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">{tr("landing.heroText")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="btn-primary px-7 text-lg" href="#account" onClick={() => setMode("signup")}>
                  {tr("landing.start")} <ArrowRight size={20} />
                </a>
                <a className="btn-ghost px-7 text-lg" href="#account" onClick={() => setMode("login")}>
                  {tr("landing.signIn")}
                </a>
              </div>
              <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={16} className="text-[var(--ok)]" /> {tr("landing.free")}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={16} className="text-[var(--ok)]" /> {tr("landing.anyPhone")}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={16} className="text-[var(--ok)]" /> {tr("landing.aiNever")}
                </span>
              </p>
            </div>
            <Mockup />
          </section>
        </div>

        <section aria-labelledby="value-title" className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
              {tr("landing.whatYouGet")}
            </p>
            <h2 id="value-title" className="mt-2 text-3xl font-bold tracking-tight">
              {tr("landing.valueTitle")}
            </h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {OUTCOMES.map((o) => (
                <li key={o.title} className="rounded-lg border border-stone-200 p-6">
                  <h3 className="text-lg font-semibold leading-snug">{o.title}</h3>
                  <p className="mt-2 text-[var(--muted)]">{o.text}</p>
                </li>
              ))}
            </ul>

            <h2 className="mt-16 text-2xl font-bold tracking-tight">{tr("landing.whyNot")}</h2>
            <p className="mt-2 max-w-2xl text-[var(--muted)]">
              Reminders tell her when. They can&apos;t tell the family whether she actually took it, or who gave it.
            </p>
            <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full min-w-[560px] text-left text-sm">
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

        <section aria-label="Why it matters" className="border-y border-amber-200/70 bg-amber-50/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-[1fr_1fr_1.2fr] md:items-center">
            <div>
              <p className="text-5xl font-extrabold text-[#b45309]">33.7%</p>
              <p className="mt-1 text-[var(--ink)]">
                of older adults in six Indian cities live with polypharmacy — many medicines at once.
              </p>
            </div>
            <div>
              <p className="text-5xl font-extrabold text-[#b45309]">19.7%</p>
              <p className="mt-1 text-[var(--ink)]">
                — about 1 in 5 — self-medicate, often without the family or doctor knowing.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-semibold">More medicines, more people helping — and nobody sure who gave what.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Source:{" "}
                <a
                  className="underline"
                  href="https://www.nature.com/articles/s41598-024-84627-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Scientific Reports (Nature), 2025
                </a>
              </p>
            </div>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-bold md:text-4xl">{tr("landing.rolesTitle")}</h2>
          <p className="mt-2 text-lg text-[var(--muted)]">Everyone helps. Only the elder decides.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ROLES.map((r) => (
              <article key={r.who} className="panel">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-[var(--brand-2)]">
                  <r.icon size={22} />
                </span>
                <p className="mt-4 text-sm font-bold uppercase tracking-wider text-[var(--brand-2)]">{r.who}</p>
                <h3 className="mt-1 text-xl font-bold">{r.title}</h3>
                <ul className="mt-3 space-y-2 text-[var(--muted)]">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ok)]" /> {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-stone-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-3xl font-bold md:text-4xl">{tr("landing.howTitle")}</h2>
            <p className="mt-2 text-lg text-[var(--muted)]">Set up in five minutes. No hardware, no app store.</p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="panel">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--soft)] text-[var(--brand)]">
                      <s.icon size={22} />
                    </span>
                    <span className="text-sm font-semibold text-[var(--muted)]">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-[var(--muted)]">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ai" className="bg-[#0b3d33] py-16 text-white">
          <div className="mx-auto max-w-6xl px-5">
            <p className="chip bg-white/10 text-emerald-100 ring-white/20">
              <Brain size={15} /> AI that warns, never prescribes
            </p>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">{tr("landing.aiTitle")}</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {AI.map((a) => (
                <article key={a.title} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                  <a.icon size={26} className="text-emerald-200" />
                  <h3 className="mt-4 text-xl font-bold">{a.title}</h3>
                  <p className="mt-2 text-emerald-50/90">{a.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-3">
          <div className="panel md:col-span-2">
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <ShieldCheck className="text-[var(--brand)]" /> Safety and trust
            </h2>
            <ul className="mt-4 grid gap-3 text-[var(--muted)] sm:grid-cols-2">
              <li className="flex gap-2">
                <LockKeyhole size={18} className="mt-1 shrink-0 text-[var(--brand)]" /> Every change is recorded under
                the signed-in person and their role in the circle.
              </li>
              <li className="flex gap-2">
                <ClipboardList size={18} className="mt-1 shrink-0 text-[var(--brand)]" /> An append-only log: who did
                what, and when. Nothing is edited or deleted.
              </li>
              <li className="flex gap-2">
                <BellRing size={18} className="mt-1 shrink-0 text-[var(--brand)]" /> Reminders never name a medicine in
                the subject line, and skips are never called missed.
              </li>
              <li className="flex gap-2">
                <Users size={18} className="mt-1 shrink-0 text-[var(--brand)]" /> Every care circle is private to its
                invited members.
              </li>
            </ul>
            <p className="mt-5 text-sm text-[var(--muted)]">
              ApnaHaath is a care log. It is not a doctor, not a diagnosis and not a medical device. It does not start,
              stop or change medicines.
            </p>
          </div>
          <div className="panel flex flex-col justify-center border-red-200 bg-red-50">
            <Phone className="text-[var(--danger)]" size={28} />
            <p className="mt-3 text-2xl font-bold text-[var(--danger)]">Emergency? Call 108.</p>
            <p className="mt-1 text-red-900">Or go to the nearest hospital. ApnaHaath does not triage emergencies.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-4">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-[#0f5c4c] to-[#0f766e] p-8 text-white md:flex-row md:items-center md:p-12">
            <div>
              <h2 className="text-3xl font-bold md:text-4xl">{tr("landing.ctaTitle")}</h2>
              <p className="mt-2 text-lg text-emerald-50">{tr("landing.ctaText")}</p>
            </div>
            <a
              className="btn bg-white px-7 text-lg text-[#0f5c4c] hover:bg-emerald-50"
              href="#account"
              onClick={() => setMode("signup")}
            >
              {tr("landing.start")} <ArrowRight size={20} />
            </a>
          </div>
        </section>

        <section id="account" className="border-y border-stone-200 bg-white py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold md:text-4xl">
                {mode === "signup" ? "Start your care circle" : "Welcome back"}
              </h2>
              <p className="mt-3 text-lg text-[var(--muted)]">
                {mode === "signup"
                  ? "Create your account, then add your elder and invite the family. Invited? Sign up with the email you want to use, then join with your invite."
                  : "Sign in to see today's medicines and your care circle."}
              </p>
            </div>
            <div className="panel">
              <div
                className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1"
                role="tablist"
                aria-label="Account"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={`rounded-lg py-2.5 font-semibold ${mode === "signup" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    setMode("signup");
                    setVerifyFor(null);
                  }}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={`rounded-lg py-2.5 font-semibold ${mode === "login" ? "bg-white shadow-sm" : "text-[var(--muted)]"}`}
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    setMode("login");
                    setVerifyFor(null);
                  }}
                >
                  Sign in
                </button>
              </div>
              {invite && (
                <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                  You have an invite. Sign up or sign in first — you can join right after.
                </p>
              )}
              {verifyFor ? (
                <form
                  className="grid gap-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onAuth(
                      "/api/auth/verify",
                      { email: verifyFor, code },
                      "Email verified. Welcome to ApnaHaath!",
                    );
                  }}
                >
                  <div className="flex items-start gap-3 rounded-xl bg-[var(--soft)] p-4">
                    <Mail size={22} className="mt-0.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                    <p>
                      We sent a 6-digit code to <strong className="break-all">{verifyFor}</strong>. It expires in 10
                      minutes.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="otp-code" className="mb-1 block text-sm font-semibold">
                      Verification code
                    </label>
                    <input
                      id="otp-code"
                      className="input text-center text-2xl tracking-[0.5em]"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />
                  </div>
                  <button className="btn-primary w-full text-lg" disabled={busy || code.length !== 6} type="submit">
                    {busy ? "Checking…" : "Verify and continue"}
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy || cooldown > 0}
                      onClick={async () => {
                        const r = await onAuth("/api/auth/resend", { email: verifyFor }, "A new code is on its way.");
                        setCooldown(Number(r.retryAfterS) || 60);
                      }}
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-[var(--brand)] underline"
                      style={{ minHeight: 44 }}
                      onClick={() => setVerifyFor(null)}
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {googleEnabled && (
                    <>
                      <a href="/api/auth/google" className="btn-ghost w-full text-base">
                        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                          <path
                            fill="#FFC107"
                            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
                          />
                          <path
                            fill="#FF3D00"
                            d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                          />
                          <path
                            fill="#4CAF50"
                            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
                          />
                          <path
                            fill="#1976D2"
                            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
                          />
                        </svg>
                        Continue with Google
                      </a>
                      <p className="my-4 flex items-center gap-3 text-sm text-[var(--muted)]">
                        <span className="h-px flex-1 bg-stone-200" /> or with email{" "}
                        <span className="h-px flex-1 bg-stone-200" />
                      </p>
                    </>
                  )}
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit();
                    }}
                  >
                    {mode === "signup" && (
                      <div>
                        <label htmlFor="auth-name" className="mb-1 block text-sm font-semibold">
                          Your name
                        </label>
                        <input
                          id="auth-name"
                          className="input"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label htmlFor="auth-email" className="mb-1 block text-sm font-semibold">
                        Email
                      </label>
                      <input
                        id="auth-email"
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="auth-password" className="mb-1 block text-sm font-semibold">
                        Password{mode === "signup" ? " (at least 8 characters)" : ""}
                      </label>
                      <input
                        id="auth-password"
                        className="input"
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "signup" ? 8 : 1}
                      />
                    </div>
                    <button className="btn-primary w-full text-lg" disabled={busy} type="submit">
                      {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                    </button>
                    {mode === "signup" && (
                      <p className="text-center text-sm text-[var(--muted)]">
                        We will email you a 6-digit code to confirm it is you.
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-3xl font-bold md:text-4xl">{tr("landing.faqTitle")}</h2>
          <div className="mt-8 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold"
                  style={{ minHeight: 44 }}
                >
                  {f.q}{" "}
                  <span className="text-[var(--muted)] transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[var(--muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="flex items-center gap-2 font-bold text-[var(--brand)]">
              <HandHeart size={20} /> ApnaHaath
            </p>
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
              A care log, not a doctor. It does not start, stop or change medicines. Talk to a qualified doctor or
              pharmacist.
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--danger)]">
              Emergency: call 108 or go to the nearest hospital.
            </p>
          </div>
          {toggles}
        </div>
      </footer>
    </div>
  );
}
