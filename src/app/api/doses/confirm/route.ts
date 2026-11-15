import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember, requirePin } from "@/lib/auth";
import { getDoseSlot, insertEvent, updateDoseSlotStatus } from "@/lib/db";
import { parseBody, pin, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only the elder can mark a dose as taken. */
export async function POST(req: Request) {
  const a = await requireMember(["elder"]);
  if ("error" in a) return a.error;
  const p = await parseBody(req, z.object({ doseSlotId: shortText(120), pin }));
  if ("error" in p) return p.error;
  const re = await requirePin(a.ctx, p.data.pin);
  if ("error" in re) return re.error;
  const hh = a.ctx.household.id;
  const slot = await getDoseSlot(hh, p.data.doseSlotId);
  if (!slot) return NextResponse.json({ error: "Dose not found" }, { status: 404 });
  if (slot.status === "skipped") return NextResponse.json({ error: "Already skipped" }, { status: 409 });
  await updateDoseSlotStatus(hh, slot.id, "elder_confirmed", null);
  const id = `evt-${randomUUID()}`;
  await insertEvent(hh, { id, type: "elder_confirmed", actor_role: "elder", actor_name: a.ctx.user.name, medicine_id: slot.medicine_id, dose_slot_id: slot.id, payload: {} });
  return NextResponse.json({ ok: true, eventId: id });
}
