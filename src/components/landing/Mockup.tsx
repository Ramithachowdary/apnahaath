import { CalendarClock, CheckCircle2, Eye, Pill, ShieldCheck } from "lucide-react";

/** Illustrative product screens for the hero (clearly labelled example content). */
export function Mockup() {
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
