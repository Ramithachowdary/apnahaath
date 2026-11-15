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
import { createDoseToken } from "./doselink";
import { deliverOutboxRow } from "./email";
import { SITE_URL } from "./site";
import { formatIstIso, minutesSince } from "./time";
import type { ReminderOutbox, Role } from "./types";

export async function familyRecipients(hh: string): Promise<string[]> {
  return (await recipients(hh, false)).map((r) => r.email);
}

export interface Recipient { email: string; uid: string | null; role: Role | null }

/** Who gets reminder emails. Upcoming-dose emails also go to the elder (with her personal one-tap link). */
export async function recipients(hh: string, includeElder: boolean): Promise<Recipient[]> {
  return (await listMembers(hh))
    .filter((m) => (m.role === "family" || (includeElder && m.role === "elder")))
    .map((m) => ({ email: m.email, uid: m.id, role: m.role }));
}

/** Personal one-tap link, emailed only to that member (kept out of the shared outbox). */
export function doseLinkFooter(hh: string, slotId: string, r: Recipient): string {
  if (!r.uid || !r.role) return "";
  const url = `${SITE_URL}/api/doses/link?t=${createDoseToken({ hid: hh, sid: slotId, uid: r.uid, role: r.role })}`;
  return r.role === "elder"
    ? `Took it? Tap once to record it in your name (link works once, for 6 hours, only for you):\n${url}`
    : `Saw the dose taken? Tap to record yourself as a witness (does not mark it taken; works once, for 6 hours):\n${url}`;
}

function hhmm(iso: string) {
  return iso.slice(11, 16);
}

export async function runMorningCheck(hh: string): Promise<{ queued: number; results: Array<{ id: string; status: string }> }> {
  await ensureTodaySlots(hh);
  const household = await getHousehold(hh);
  const elder = household?.elder_name ?? "your elder";
  const family = await recipients(hh, false);
  const withElder = await recipients(hh, true);
  let queued = 0;
  const results: Array<{ id: string; status: string }> = [];

  async function queue(kind: ReminderOutbox["kind"], key: string, subject: string, lines: string[], slotId?: string) {
    for (const r of slotId ? withElder : family) {
      const email = r.email;
      const row: ReminderOutbox = {
        id: `out-${randomUUID()}`,
        household_id: hh,
        kind,
        to_email: email,
        // Subjects never contain drug names or diagnoses
        subject,
        body: [...lines, ...(slotId && r.uid ? ["", "(A personal one-tap link was included in this email only.)"] : []), "", MEDICAL_DISCLAIMER, EMERGENCY_LINE].join("\n"),
        idempotency_key: `${hh}:${key}:${email}`,
        status: "queued",
        created_at: formatIstIso(),
        sent_at: null,
        error: null,
      };
      if (await insertOutbox(row)) {
        queued += 1;
        await deliverOutboxRow(row, false, slotId ? doseLinkFooter(hh, slotId, r) : "");
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
      ], slot.id);
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
