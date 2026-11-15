/** Append-only care event log and appointments. */
import type { Appointment, CareEvent } from "../types";
import { formatIstIso } from "../time";
import { all, batch, one, type Stmt } from "./driver";

/** One care event to append to the authorship log. */
export type EventInput = {
  id: string;
  type: string;
  actor_role: string;
  actor_name: string;
  medicine_id?: string | null;
  dose_slot_id?: string | null;
  appointment_id?: string | null;
  payload: unknown;
  created_at?: string;
};
/** Insert event (batch statement), scoped to one household. */
export const insertEventStmt = (hh: string, e: EventInput): Stmt => ({
  sql: `INSERT INTO care_events (id,household_id,type,actor_role,actor_name,medicine_id,dose_slot_id,appointment_id,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  args: [
    e.id,
    hh,
    e.type,
    e.actor_role,
    e.actor_name,
    e.medicine_id ?? null,
    e.dose_slot_id ?? null,
    e.appointment_id ?? null,
    JSON.stringify(e.payload),
    e.created_at ?? formatIstIso(),
  ],
});
/** Insert event, scoped to one household. */
export async function insertEvent(hh: string, e: EventInput) {
  await batch([insertEventStmt(hh, e)]);
}
/** List events, scoped to one household. */
export async function listEvents(hh: string, limit = 50) {
  return all<CareEvent>(`SELECT * FROM care_events WHERE household_id = ? ORDER BY created_at DESC LIMIT ?`, [
    hh,
    limit,
  ]);
}

/** Appointments of one household, soonest first. */
export async function listAppointments(hh: string) {
  return all<Appointment>(`SELECT * FROM appointments WHERE household_id = ? ORDER BY scheduled_at`, [hh]);
}
/** Get appointment, scoped to one household. */
export async function getAppointment(hh: string, id: string) {
  return one<Appointment>(`SELECT * FROM appointments WHERE id = ? AND household_id = ?`, [id, hh]);
}
/** Upsert appointment (batch statement). */
export const upsertAppointmentStmt = (a: Appointment): Stmt => ({
  sql: `INSERT INTO appointments (id,household_id,doctor,place,scheduled_at,notes) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET doctor=excluded.doctor, place=excluded.place, scheduled_at=excluded.scheduled_at, notes=excluded.notes
        WHERE appointments.household_id = excluded.household_id`,
  args: [a.id, a.household_id, a.doctor, a.place, a.scheduled_at, a.notes],
});
/** Upsert appointment. */
export async function upsertAppointment(a: Appointment) {
  await batch([upsertAppointmentStmt(a)]);
}
