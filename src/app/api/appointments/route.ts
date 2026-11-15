import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember, requirePin } from "@/lib/auth";
import { getAppointment, insertEvent, upsertAppointment } from "@/lib/db";
import { parseBody, pin, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Family adds or edits an appointment (scoped to their care circle). */
export async function POST(req: Request) {
  const a = await requireMember(["family"]);
  if ("error" in a) return a.error;
  const p = await parseBody(req, z.object({
    pin, id: z.string().max(80).optional(), doctor: shortText(120), place: shortText(160),
    scheduled_at: z.string().min(10).max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time"),
    notes: z.string().max(500).optional(),
  }));
  if ("error" in p) return p.error;
  const re = await requirePin(a.ctx, p.data.pin);
  if ("error" in re) return re.error;
  const hh = a.ctx.household.id;
  if (p.data.id && !(await getAppointment(hh, p.data.id))) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  const id = p.data.id ?? `appt-${randomUUID().slice(0, 12)}`;
  // Normalise to IST wall-clock ISO
  const when = /[+-]\d{2}:\d{2}$|Z$/.test(p.data.scheduled_at) ? p.data.scheduled_at : `${p.data.scheduled_at.slice(0, 16)}:00+05:30`;
  await upsertAppointment({ id, household_id: hh, doctor: p.data.doctor, place: p.data.place, scheduled_at: when, notes: p.data.notes ?? null });
  await insertEvent(hh, { id: `evt-${randomUUID()}`, type: p.data.id ? "appointment_updated" : "appointment_created", actor_role: "family", actor_name: a.ctx.user.name, appointment_id: id, payload: { doctor: p.data.doctor, place: p.data.place, when } });
  return NextResponse.json({ ok: true, id });
}
