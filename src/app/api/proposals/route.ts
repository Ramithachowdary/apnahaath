import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember, requirePin } from "@/lib/auth";
import {
  ensureTodaySlots,
  getMedicine,
  getProposal,
  insertEvent,
  insertMedicine,
  insertProposal,
  setMedicineActive,
  updateMedicineSchedule,
  updateProposalStatus,
} from "@/lib/db";
import { checkThyronormShelcalGap } from "@/lib/rules";
import { hhmm, parseBody, pin, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Payload = z
  .object({
    name: z.string().trim().max(80).optional(),
    dose: z.string().trim().max(60).optional(),
    schedule_time: hhmm.optional(),
    instructions: z.string().trim().max(200).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

/** Family proposes add / change time / stop; nothing changes until the elder accepts. The elder's own changes apply at once (her decision). */
export async function POST(req: Request) {
  const a = await requireMember(["family", "elder"]);
  if ("error" in a) return a.error;
  const p = await parseBody(
    req,
    z.object({
      pin,
      kind: z.enum(["add", "edit_schedule", "stop"]),
      medicineId: z.string().max(120).optional(),
      payload: Payload,
    }),
  );
  if ("error" in p) return p.error;
  const hh = a.ctx.household.id;
  const { kind, payload } = p.data;
  const med = p.data.medicineId ? await getMedicine(hh, p.data.medicineId) : undefined;
  if (kind !== "add" && !med) return NextResponse.json({ error: "Unknown medicine" }, { status: 400 });
  if (kind === "add" && (!payload.name || !payload.schedule_time))
    return NextResponse.json({ error: "Medicine name and time are required" }, { status: 400 });
  if (kind === "edit_schedule" && !payload.schedule_time)
    return NextResponse.json({ error: "New time is required" }, { status: 400 });
  const re = await requirePin(a.ctx, p.data.pin);
  if ("error" in re) return re.error;
  if (payload.schedule_time) {
    const gap = await checkThyronormShelcalGap(hh, {
      medicineName: med?.name ?? payload.name ?? "",
      scheduleTime: payload.schedule_time,
    });
    if (!gap.ok) return NextResponse.json({ error: gap.message_en }, { status: 400 });
  }
  const id = `prop-${randomUUID()}`;
  await insertProposal(hh, { id, kind, medicine_id: med?.id ?? null, payload, created_by: a.ctx.user.name });
  const byElder = a.ctx.membership.role === "elder";
  await insertEvent(hh, {
    id: `evt-${randomUUID()}`,
    type: kind === "stop" ? "stop_proposed" : "change_proposed",
    actor_role: a.ctx.membership.role,
    actor_name: a.ctx.user.name,
    medicine_id: med?.id ?? null,
    payload: { proposalId: id, kind, ...payload },
  });
  if (byElder) {
    await applyAccepted(
      hh,
      { id, kind, medicine_id: med?.id ?? null, payload: payload as Record<string, string> },
      a.ctx.user.name,
    );
    return NextResponse.json({ ok: true, proposalId: id, status: "accepted" });
  }
  return NextResponse.json({ ok: true, proposalId: id });
}

/** Elder accepts / rejects. */
export async function PATCH(req: Request) {
  const a = await requireMember(["elder"]);
  if ("error" in a) return a.error;
  const p = await parseBody(req, z.object({ pin, proposalId: shortText(120), decision: z.enum(["accept", "reject"]) }));
  if ("error" in p) return p.error;
  const re = await requirePin(a.ctx, p.data.pin);
  if ("error" in re) return re.error;
  const hh = a.ctx.household.id;
  const prop = await getProposal(hh, p.data.proposalId);
  if (!prop || prop.status !== "pending")
    return NextResponse.json({ error: "Suggestion not pending" }, { status: 404 });
  const evt = (type: string, extra: Record<string, unknown> = {}) =>
    insertEvent(hh, {
      id: `evt-${randomUUID()}`,
      type,
      actor_role: "elder",
      actor_name: a.ctx.user.name,
      medicine_id: prop.medicine_id,
      payload: { proposalId: prop.id, ...extra },
    });
  if (p.data.decision === "reject") {
    await updateProposalStatus(hh, prop.id, "rejected");
    await evt("change_rejected");
    return NextResponse.json({ ok: true, status: "rejected" });
  }
  const payload = JSON.parse(prop.payload_json) as Record<string, string>;
  if (prop.kind === "edit_schedule" && prop.medicine_id) {
    const med = await getMedicine(hh, prop.medicine_id);
    const gap = await checkThyronormShelcalGap(hh, {
      medicineName: med?.name ?? "",
      scheduleTime: payload.schedule_time,
    });
    if (!gap.ok) return NextResponse.json({ error: gap.message_en }, { status: 400 });
  }
  await applyAccepted(hh, { id: prop.id, kind: prop.kind, medicine_id: prop.medicine_id, payload }, a.ctx.user.name);
  return NextResponse.json({ ok: true, status: "accepted" });
}

async function applyAccepted(
  hh: string,
  prop: { id: string; kind: string; medicine_id: string | null; payload: Record<string, string> },
  elderName: string,
) {
  const payload = prop.payload;
  if (prop.kind === "edit_schedule" && prop.medicine_id)
    await updateMedicineSchedule(hh, prop.medicine_id, payload.schedule_time);
  if (prop.kind === "stop" && prop.medicine_id) await setMedicineActive(hh, prop.medicine_id, 0);
  if (prop.kind === "add") {
    await insertMedicine({
      id: `med-${randomUUID().slice(0, 12)}`,
      household_id: hh,
      name: payload.name,
      brand_hi: payload.name,
      dose: payload.dose ?? "",
      schedule_time: payload.schedule_time ?? "09:00",
      instructions: payload.instructions ?? "",
      color_band: "#0f766e",
      active: 1,
      notes: null,
    });
    await ensureTodaySlots(hh);
  }
  await updateProposalStatus(hh, prop.id, "accepted");
  await insertEvent(hh, {
    id: `evt-${randomUUID()}`,
    type: "change_accepted",
    actor_role: "elder",
    actor_name: elderName,
    medicine_id: prop.medicine_id,
    payload: { proposalId: prop.id, kind: prop.kind },
  });
}
