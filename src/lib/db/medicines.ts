/** Medicines, daily dose slots and adherence counts. */
import type { AdherenceStats, DoseSlot, Medicine } from "../types";
import { MISS_GRACE_MINUTES } from "../constants";
import { addDaysIst, istDateTimeOnToday, minutesSince, todayIstDateString } from "../time";
import { all, batch, one, run, type Stmt } from "./driver";

/** Medicines of one household by time of day; `activeOnly` skips stopped ones. */
export async function listMedicines(hh: string, activeOnly = false) {
  return all<Medicine>(
    `SELECT * FROM medicines WHERE household_id = ? ${activeOnly ? "AND active = 1" : ""} ORDER BY schedule_time`,
    [hh],
  );
}
/** Get medicine, scoped to one household. */
export async function getMedicine(hh: string, id: string) {
  return one<Medicine>(`SELECT * FROM medicines WHERE id = ? AND household_id = ?`, [id, hh]);
}
/** Insert medicine (batch statement). */
export const insertMedicineStmt = (m: Medicine): Stmt => ({
  sql: `INSERT INTO medicines (id,household_id,name,brand_hi,dose,schedule_time,instructions,color_band,active,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  args: [
    m.id,
    m.household_id,
    m.name,
    m.brand_hi,
    m.dose,
    m.schedule_time,
    m.instructions,
    m.color_band,
    m.active,
    m.notes,
  ],
});
/** Insert medicine. */
export async function insertMedicine(m: Medicine) {
  await batch([insertMedicineStmt(m)]);
}
/** Activate or stop a medicine; stopping also removes its pending slots. One atomic round trip. */
export async function setMedicineActive(hh: string, id: string, active: number) {
  const stmts: Stmt[] = [
    { sql: `UPDATE medicines SET active = ? WHERE id = ? AND household_id = ?`, args: [active, id, hh] },
  ];
  if (!active)
    stmts.push({
      sql: `DELETE FROM dose_slots WHERE medicine_id = ? AND household_id = ? AND status = 'pending'`,
      args: [id, hh],
    });
  await batch(stmts);
}
/** Move a medicine to a new HH:MM time and re-time today's pending slot, atomically. */
export async function updateMedicineSchedule(hh: string, id: string, t: string) {
  await batch([
    { sql: `UPDATE medicines SET schedule_time = ? WHERE id = ? AND household_id = ?`, args: [t, id, hh] },
    {
      sql: `UPDATE dose_slots SET scheduled_at = ? WHERE medicine_id = ? AND household_id = ? AND status = 'pending'`,
      args: [istDateTimeOnToday(t), id, hh],
    },
  ]);
}
/** Deterministic slot id for one medicine on one IST day, so slot creation is idempotent. */
export function slotIdFor(medId: string, day = todayIstDateString()) {
  return `${medId}-${day.replaceAll("-", "")}`;
}
/**
 * Create today's dose slots for every active medicine in a single INSERT ... SELECT (idempotent).
 * Ids and timestamps match `slotIdFor` and `istDateTimeOnToday`.
 */
export async function ensureTodaySlots(hh: string) {
  const day = todayIstDateString();
  await run(
    `INSERT INTO dose_slots (id,household_id,medicine_id,scheduled_at,status,skip_reason)
     SELECT id || '-' || ?::text, household_id, id,
            ?::text || 'T' || lpad(split_part(schedule_time, ':', 1), 2, '0') || ':' || lpad(split_part(schedule_time, ':', 2), 2, '0') || ':00+05:30',
            'pending', NULL
     FROM medicines WHERE household_id = ? AND active = 1
     ON CONFLICT (id) DO NOTHING`,
    [day.replaceAll("-", ""), day, hh],
  );
}
/** A dose slot joined with the medicine fields the UI shows. */
export type SlotRow = DoseSlot & {
  medicine_name: string;
  brand_hi: string;
  color_band: string;
  instructions: string;
  med_dose?: string;
};
const SLOT_SELECT = `SELECT d.*, m.name as medicine_name, m.brand_hi, m.color_band, m.dose as med_dose, m.instructions
     FROM dose_slots d JOIN medicines m ON m.id = d.medicine_id`;
/**
 * Today's (or one IST day's) slots in time order. Range predicates on the ISO text keep the
 * (household_id, scheduled_at) index usable, unlike substr().
 */
export async function listDoseSlots(hh: string, day = todayIstDateString()) {
  return all<SlotRow>(
    `${SLOT_SELECT} WHERE d.household_id = ? AND d.scheduled_at >= ? AND d.scheduled_at < ? ORDER BY d.scheduled_at`,
    [hh, day, addDaysIst(day, 1)],
  );
}
/** Slots from `sinceDay` (inclusive) onwards, newest first. */
export async function listRecentSlots(hh: string, sinceDay: string) {
  return all<SlotRow>(`${SLOT_SELECT} WHERE d.household_id = ? AND d.scheduled_at >= ? ORDER BY d.scheduled_at DESC`, [
    hh,
    sinceDay,
  ]);
}
/** Get dose slot, scoped to one household. */
export async function getDoseSlot(hh: string, id: string) {
  return one<DoseSlot>(`SELECT * FROM dose_slots WHERE id = ? AND household_id = ?`, [id, hh]);
}
/** Update dose slot status. */
export async function updateDoseSlotStatus(
  hh: string,
  id: string,
  status: DoseSlot["status"],
  skipReason: string | null = null,
) {
  await run(`UPDATE dose_slots SET status = ?, skip_reason = ? WHERE id = ? AND household_id = ?`, [
    status,
    skipReason,
    id,
    hh,
  ]);
}

/**
 * Adherence counts for a set of today's slots. Pure, so callers that already loaded the slots
 * (the /api/state route) do not query them twice.
 */
export function summarizeAdherence(
  slots: Pick<DoseSlot, "status" | "scheduled_at">[],
  witnessed: number,
): AdherenceStats {
  let elderConfirmed = 0,
    skipped = 0,
    missed = 0,
    pending = 0,
    dueOrPast = 0;
  for (const s of slots) {
    const age = minutesSince(s.scheduled_at);
    if (age >= 0) dueOrPast += 1;
    if (s.status === "elder_confirmed") elderConfirmed += 1;
    else if (s.status === "skipped") skipped += 1;
    else if (s.status === "missed") missed += 1;
    else if (age > MISS_GRACE_MINUTES) missed += 1;
    else pending += 1;
  }
  // Skips are an elder decision, not a failure: excluded from the denominator.
  const denom = elderConfirmed + missed;
  const elderConfirmationRate = denom === 0 ? null : Math.round((elderConfirmed / denom) * 1000) / 10;
  return { elderConfirmed, witnessed, skipped, missed, pending, dueOrPast, elderConfirmationRate };
}
/** Number of caregiver-witnessed doses recorded today (IST). */
export async function countWitnessedToday(hh: string): Promise<number> {
  const day = todayIstDateString();
  const w = await one<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM care_events WHERE household_id = ? AND type = 'witnessed' AND created_at >= ? AND created_at < ?`,
    [hh, day, addDaysIst(day, 1)],
  );
  return Number(w?.c ?? 0);
}
/** Today's adherence for one household. */
export async function getAdherenceStats(hh: string): Promise<AdherenceStats> {
  const [slots, witnessed] = await Promise.all([listDoseSlots(hh), countWitnessedToday(hh)]);
  return summarizeAdherence(slots, witnessed);
}
