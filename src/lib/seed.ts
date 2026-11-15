import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { EMERGENCY_LINE, MEDICAL_DISCLAIMER } from "./constants";
import {
  type Stmt,
  addMembershipStmt,
  batch,
  createHouseholdStmt,
  createUserStmt,
  insertDecisionCardStmt,
  insertEventStmt,
  insertMedicineStmt,
  slotIdFor,
  upsertAppointmentStmt,
} from "./db";
import { addDaysIst, formatIstIso, istDateTimeOnToday, todayIstDateString } from "./time";
import type { Role } from "./types";

export const DEMO_PINS: Record<Role, string> = { elder: "1111", caretaker: "2222", family: "3333" };

export interface DemoCredential {
  role: Role;
  name: string;
  email: string;
  password: string;
  pin: string;
}

/**
 * Creates a fresh, isolated demo household (fictional Kamla Devi Shukla) with three demo accounts.
 * Credentials are random per demo and shown only to members of that demo household.
 */
export async function createDemoHousehold(): Promise<{ householdId: string; credentials: DemoCredential[]; userIds: Record<Role, string> }> {
  const hh = `hh-${randomUUID()}`;
  const tag = randomBytes(3).toString("hex");
  const people: Array<{ role: Role; name: string; local: string }> = [
    { role: "family", name: "Priya Mehra", local: "priya" },
    { role: "elder", name: "Kamla Devi Shukla", local: "kamla" },
    { role: "caretaker", name: "Sunita", local: "sunita" },
  ];
  const credentials: DemoCredential[] = [];
  const userIds = {} as Record<Role, string>;
  const stmts: Stmt[] = [];
  {
    for (const p of people) {
      const uid = `u-${randomUUID()}`;
      const password = `demo-${randomBytes(4).toString("hex")}`;
      const email = `${p.local}.${tag}@demo.apnahaath.app`;
      stmts.push(createUserStmt({ id: uid, name: p.name, email, password_hash: bcrypt.hashSync(password, 8), is_demo: 1 }));
      userIds[p.role] = uid;
      credentials.push({ role: p.role, name: p.name, email, password, pin: DEMO_PINS[p.role] });
    }
    stmts.push(createHouseholdStmt({
      id: hh,
      elder_name: "Kamla Devi Shukla",
      elder_age: 74,
      city: "Aliganj, Lucknow",
      language: "English",
      owner_user_id: userIds.family,
      is_demo: 1,
      demo_credentials_json: JSON.stringify(credentials),
    }));
    for (const p of people) {
      stmts.push(addMembershipStmt({
        id: `ms-${randomUUID()}`,
        user_id: userIds[p.role],
        household_id: hh,
        role: p.role,
        pin_hash: bcrypt.hashSync(DEMO_PINS[p.role], 8),
      }));
    }
    stmts.push(...kamlaCareDataStmts(hh));
  }
  await batch(stmts);
  return { householdId: hh, credentials, userIds };
}

const MEDS = [
  { key: "thyronorm", name: "Thyronorm 50", dose: "50 mcg", time: "06:30", instructions: "Empty stomach, 30 min before tea", color: "#2563eb", notes: "Keep 4 hours away from Shelcal" },
  { key: "telma", name: "Telma 40", dose: "40 mg", time: "08:00", instructions: "After breakfast", color: "#059669", notes: null },
  { key: "glycomet", name: "Glycomet 500", dose: "500 mg", time: "13:30", instructions: "With lunch", color: "#d97706", notes: null },
  { key: "shelcal", name: "Shelcal 500", dose: "500 mg", time: "16:00", instructions: "Afternoon, 4 hours after Thyronorm", color: "#7c3aed", notes: "Must stay 4+ hours from Thyronorm" },
  { key: "ecosprin", name: "Ecosprin 75", dose: "75 mg", time: "21:00", instructions: "After dinner", color: "#dc2626", notes: null },
] as const;

export function kamlaCareDataStmts(hh: string): Stmt[] {
  const out: Stmt[] = [];
  const ids: Record<string, string> = {};
  for (const m of MEDS) {
    const id = `med-${m.key}-${hh.slice(3, 11)}`;
    ids[m.key] = id;
    out.push(insertMedicineStmt({
      id, household_id: hh, name: m.name, brand_hi: m.name, dose: m.dose, schedule_time: m.time,
      instructions: m.instructions, color_band: m.color, active: 1, notes: m.notes,
    }));
  }
  const slot = { run: (...args: Array<string | null>) => out.push({
    sql: `INSERT INTO dose_slots (id,household_id,medicine_id,scheduled_at,status,skip_reason) VALUES (?,?,?,?,?,?)`, args }) };
  for (const m of MEDS) {
    slot.run(slotIdFor(ids[m.key]), hh, ids[m.key], istDateTimeOnToday(m.time), m.key === "thyronorm" ? "elder_confirmed" : "pending", null);
  }
  // A few days of history so the judge sees interesting state immediately
  const today = todayIstDateString();
  for (let d = 1; d <= 3; d++) {
    const day = addDaysIst(today, -d);
    for (const m of MEDS) {
      const status = d === 2 && m.key === "glycomet" ? "skipped" : d === 3 && m.key === "ecosprin" ? "missed" : "elder_confirmed";
      slot.run(slotIdFor(ids[m.key], day), hh, ids[m.key], `${day}T${m.time}:00+05:30`, status, status === "skipped" ? "Fasting" : null);
      out.push(insertEventStmt(hh, {
        id: `evt-${randomUUID()}`, type: status, actor_role: status === "missed" ? "system" : "elder",
        actor_name: status === "missed" ? "System" : "Kamla Devi Shukla", medicine_id: ids[m.key],
        dose_slot_id: slotIdFor(ids[m.key], day), payload: status === "skipped" ? { reason: "Fasting" } : {},
        created_at: `${day}T${m.time.slice(0, 3)}${String(Number(m.time.slice(3)) + 9).padStart(2, "0")}:00+05:30`,
      }));
    }
  }
  out.push(insertEventStmt(hh, {
    id: `evt-${randomUUID()}`, type: "elder_confirmed", actor_role: "elder", actor_name: "Kamla Devi Shukla",
    medicine_id: ids.thyronorm, dose_slot_id: slotIdFor(ids.thyronorm), payload: { note: "Confirmed at the kitchen table" },
    created_at: istDateTimeOnToday("06:41"),
  }));
  const brufenEvt = `evt-${randomUUID()}`;
  out.push(insertEventStmt(hh, {
    id: brufenEvt, type: "self_added", actor_role: "elder", actor_name: "Kamla Devi Shukla",
    payload: { medicine_name: "Brufen", dose: "400 mg", reason: "Knee pain", illustrative: true },
  }));
  out.push(insertDecisionCardStmt({
    id: `card-${randomUUID()}`, household_id: hh, source_event_id: brufenEvt, severity: "review_required",
    title: "Brufen + Ecosprin — safety review",
    elder_line_hi: "Kamla ji, taking Brufen together with Ecosprin can raise the risk of bleeding. Nothing in your medicines was changed. Please talk to your doctor.",
    caretaker_line_hi: "Please do not give Brufen until the doctor says it is okay. Kamla ji's own entry stays on record.",
    family_line_en: "Kamla self-reported Brufen while Ecosprin 75 is on her list. Possible interaction — needs a clinician's review. No prescription was changed by the app.",
    tell_doctor: "Mention the self-added Brufen alongside Ecosprin 75 at Thursday's OPD.",
    disclaimer: MEDICAL_DISCLAIMER, emergency_line: EMERGENCY_LINE, cached: 1, created_at: formatIstIso(),
  }));
  out.push(upsertAppointmentStmt({
    id: `appt-${randomUUID().slice(0, 8)}`, household_id: hh, doctor: "Dr. R.K. Sharma", place: "Aliganj Clinic, Lucknow",
    scheduled_at: `${nextWeekdayIst(4)}T11:15:00+05:30`, notes: "Physician OPD — bring this week's care log",
  }));
  return out;
}

function nextWeekdayIst(targetDow: number): string {
  const today = todayIstDateString();
  const dow = new Date(`${today}T12:00:00+05:30`).getUTCDay();
  let add = (targetDow - dow + 7) % 7;
  if (add === 0) add = 7;
  return addDaysIst(today, add);
}
