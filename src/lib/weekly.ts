import { z } from "zod";
import { adaptionJson } from "./adaption";
import { MEDICAL_DISCLAIMER } from "./constants";
import { listEvents, listRecentSlots } from "./db";
import { rejectsMutation } from "./gemini";
import { addDaysIst, todayIstDateString } from "./time";

/**
 * Weekly care summary. Numbers are computed in code from the last 7 days of the log;
 * Adaption only phrases them for each role. Output is validated and never suggests a dose change.
 */
export interface WeekStats {
  from: string;
  to: string;
  confirmed: number;
  skipped: number;
  missed: number;
  pending: number;
  witnessed: number;
  selfAdded: number;
  rate: number | null;
  skipReasons: Record<string, number>;
  perMedicine: Array<{ name: string; confirmed: number; skipped: number; missed: number }>;
  mostMissed: string | null;
}

const SummarySchema = z.object({
  elder: z.string().min(5).max(400),
  caretaker: z.string().min(5).max(600),
  family: z.string().min(10).max(1200),
});
export type WeeklySummary = z.infer<typeof SummarySchema>;

export async function computeWeekStats(hh: string): Promise<WeekStats> {
  const to = todayIstDateString();
  const from = addDaysIst(to, -6);
  const slots = await listRecentSlots(hh, from);
  const events = (await listEvents(hh, 500)).filter((e) => e.created_at.slice(0, 10) >= from);
  const per = new Map<string, { name: string; confirmed: number; skipped: number; missed: number }>();
  const skipReasons: Record<string, number> = {};
  let confirmed = 0, skipped = 0, missed = 0, pending = 0;
  for (const s of slots) {
    const m = per.get(s.medicine_name) ?? { name: s.medicine_name, confirmed: 0, skipped: 0, missed: 0 };
    if (s.status === "elder_confirmed") { confirmed++; m.confirmed++; }
    else if (s.status === "skipped") { skipped++; m.skipped++; const r = s.skip_reason || "No reason"; skipReasons[r] = (skipReasons[r] ?? 0) + 1; }
    else if (s.status === "missed") { missed++; m.missed++; }
    else pending++;
    per.set(s.medicine_name, m);
  }
  const perMedicine = [...per.values()].sort((a, b) => b.missed - a.missed);
  return {
    from, to, confirmed, skipped, missed, pending,
    witnessed: events.filter((e) => e.type === "witnessed").length,
    selfAdded: events.filter((e) => e.type === "self_added").length,
    rate: confirmed + missed > 0 ? Math.round((confirmed / (confirmed + missed)) * 100) : null,
    skipReasons,
    perMedicine,
    mostMissed: perMedicine[0] && perMedicine[0].missed > 0 ? perMedicine[0].name : null,
  };
}

export function validateWeeklySummary(raw: unknown): { ok: true; summary: WeeklySummary } | { ok: false; error: string } {
  const p = SummarySchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.message };
  if (rejectsMutation(`${p.data.elder} ${p.data.caretaker} ${p.data.family}`)) return { ok: false, error: "Summary implies a dose/prescription change" };
  return { ok: true, summary: p.data };
}

export function templateWeeklySummary(st: WeekStats, elderName: string): WeeklySummary {
  const first = elderName.split(" ")[0];
  const rate = st.rate === null ? "not enough doses yet" : `${st.rate}%`;
  const reasons = Object.entries(st.skipReasons).map(([r, n]) => `${r} (${n})`).join(", ") || "none";
  return {
    elder: `${first} ji, this week you confirmed ${st.confirmed} doses yourself. Thank you. If anything feels wrong, tell your family or doctor.`,
    caretaker: [
      `This week: ${st.confirmed} confirmed by ${first}, ${st.witnessed} witnessed by you, ${st.missed} not confirmed.`,
      st.mostMissed ? `Gently remind ${first} around the ${st.mostMissed} time and let her mark it herself.` : `Keep reminding ${first} at each dose time and let her mark it herself.`,
    ].join("\n"),
    family: [
      `Week ${st.from} to ${st.to} (IST)`,
      `Elder-confirmation rate: ${rate} — ${st.confirmed} confirmed, ${st.missed} missed, ${st.skipped} skipped with a reason, ${st.witnessed} witnessed by the caretaker.`,
      `Skip reasons: ${reasons}.`,
      st.selfAdded ? `${first} added ${st.selfAdded} medicine(s) herself — check the safety notes.` : `No self-added medicines this week.`,
      st.mostMissed ? `Most missed: ${st.mostMissed}. Worth mentioning at the next doctor visit.` : `No pattern of missed doses.`,
      "No prescription or dose was changed by ApnaHaath.",
    ].join("\n"),
  };
}

export async function generateWeeklySummary(hh: string, elderName: string): Promise<{
  stats: WeekStats; summary: WeeklySummary; source: "adaption" | "template"; disclaimer: string; error?: string;
}> {
  const stats = await computeWeekStats(hh);
  const fallback = templateWeeklySummary(stats, elderName);
  try {
    const raw = await adaptionJson(
      "You write a weekly medicine-log summary for a family care circle in plain, simple English, using ONLY the numbers given. " +
        "Never suggest starting, stopping, or changing any medicine or dose; never diagnose. Return ONLY JSON: " +
        '{"elder": 1-2 warm, simple sentences for the elder (large text), "caretaker": 2-3 short task lines, ' +
        '"family": 4-6 reassuring lines with the elder-confirmation rate, missed/skipped counts and one thing to tell the doctor}.',
      { elder_name: elderName, week: stats },
      600,
    );
    const v = validateWeeklySummary(raw);
    if (!v.ok) throw new Error(v.error);
    return { stats, summary: v.summary, source: "adaption", disclaimer: MEDICAL_DISCLAIMER };
  } catch (e) {
    return { stats, summary: fallback, source: "template", disclaimer: MEDICAL_DISCLAIMER, error: e instanceof Error ? e.message : "Adaption failed" };
  }
}
