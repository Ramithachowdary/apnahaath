import { randomUUID } from "crypto";
import { EMERGENCY_LINE, MEDICAL_DISCLAIMER, MISS_GRACE_MINUTES } from "./constants";
import {
  ensureTodaySlots,
  getHousehold,
  insertEvent,
  insertOutbox,
  listAppointments,
  listDoseSlots,
  listMembers,
  updateDoseSlotStatus,
} from "./db";
import { deliverOutboxRow } from "./email";
import { formatIstIso, minutesSince } from "./time";
import type { ReminderOutbox } from "./types";

/** Family members' real emails; demo households only email NOTIFY_EMAIL (else outbox-only). */
export async function familyRecipients(hh: string): Promise<string[]> {
  const household = await getHousehold(hh);
  if (household?.is_demo) {
    return [process.env.NOTIFY_EMAIL || "family.demo@demo.apnahaath.app"];
  }
  return (await listMembers(hh))
    .filter((m) => m.role === "family" && !m.is_demo)
    .map((m) => m.email);
}

function hhmm(iso: string) {
  return iso.slice(11, 16);
}

export async function runMorningCheck(hh: string): Promise<{ queued: number; results: Array<{ id: string; status: string }> }> {
  await ensureTodaySlots(hh);
  const household = await getHousehold(hh);
  const elder = household?.elder_name ?? "your elder";
  const to = await familyRecipients(hh);
  let queued = 0;
  const results: Array<{ id: string; status: string }> = [];

  async function queue(kind: ReminderOutbox["kind"], key: string, subject: string, lines: string[]) {
    for (const email of to) {
      const row: ReminderOutbox = {
        id: `out-${randomUUID()}`,
        household_id: hh,
        kind,
        to_email: email,
        // Subjects never contain drug names or diagnoses
        subject,
        body: [...lines, "", MEDICAL_DISCLAIMER, EMERGENCY_LINE].join("\n"),
        idempotency_key: `${hh}:${key}:${email}`,
        status: "queued",
        created_at: formatIstIso(),
        sent_at: null,
        error: null,
      };
      if (await insertOutbox(row)) {
        queued += 1;
        await deliverOutboxRow(row, Boolean(household?.is_demo) && !process.env.NOTIFY_EMAIL);
        results.push({ id: row.id, status: kind });
      }
    }
  }

  for (const slot of await listDoseSlots(hh)) {
    // Never nag skipped (elder's decision) or already-confirmed doses
    if (slot.status !== "pending") continue;
    const age = minutesSince(slot.scheduled_at);
    if (age >= -60 && age < 0) {
      await queue("upcoming", `upcoming:${slot.id}`, "ApnaHaath: a dose is coming up", [
        `${elder} has ${slot.medicine_name} due at ${hhmm(slot.scheduled_at)} IST.`,
        "Only she can mark it as taken. A caretaker can only witness.",
      ]);
    }
    if (age > MISS_GRACE_MINUTES) {
      await updateDoseSlotStatus(hh, slot.id, "missed", null);
      await insertEvent(hh, {
        id: `evt-${randomUUID()}`, type: "missed", actor_role: "system", actor_name: "System",
        medicine_id: slot.medicine_id, dose_slot_id: slot.id, payload: { grace_minutes: MISS_GRACE_MINUTES },
      });
      await queue("missed", `missed:${slot.id}`, "ApnaHaath: a dose was not confirmed", [
        `${slot.medicine_name} (due ${hhmm(slot.scheduled_at)} IST) has no answer from ${elder} after ${MISS_GRACE_MINUTES} minutes.`,
        "Skipped doses are never reported as missed. Please check in kindly.",
      ]);
    }
  }

  for (const appt of await listAppointments(hh)) {
    const age = minutesSince(appt.scheduled_at);
    if (age >= -24 * 60 && age <= 60) {
      await queue("appointment", `appt:${appt.id}:${appt.scheduled_at}`, "ApnaHaath: appointment reminder", [
        `${appt.doctor} at ${appt.place} — ${appt.scheduled_at.slice(0, 10)} ${hhmm(appt.scheduled_at)} IST`,
        appt.notes ?? "",
      ]);
    }
  }
  return { queued, results };
}
