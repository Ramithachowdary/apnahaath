import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember, requirePin } from "@/lib/auth";
import { insertDecisionCard, insertEvent } from "@/lib/db";
import { generateDecisionCard } from "@/lib/gemini";
import { parseBody, pinOptional, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "I took it myself" — the elder records a medicine that is not on her list. */
export async function POST(req: Request) {
  const a = await requireMember(["elder"]);
  if ("error" in a) return a.error;
  const p = await parseBody(
    req,
    z.object({
      pin: pinOptional,
      medicineName: shortText(80),
      dose: z.string().trim().max(60).optional(),
      reason: z.string().trim().max(200).optional(),
      generateCard: z.boolean().optional(),
    }),
  );
  if ("error" in p) return p.error;
  const re = await requirePin(a.ctx, p.data.pin);
  if ("error" in re) return re.error;
  const hh = a.ctx.household.id;
  const eventId = `evt-${randomUUID()}`;
  await insertEvent(hh, {
    id: eventId,
    type: "self_added",
    actor_role: "elder",
    actor_name: a.ctx.user.name,
    payload: { medicine_name: p.data.medicineName, dose: p.data.dose ?? "", reason: p.data.reason ?? "" },
  });
  let card = null;
  if (p.data.generateCard) {
    const gen = await generateDecisionCard({
      hh,
      sourceEventId: eventId,
      context: `Elder self-added ${p.data.medicineName} (${p.data.dose ?? ""}) reason=${p.data.reason ?? ""}`,
      medicineHint: p.data.medicineName,
    });
    await insertDecisionCard(gen.card);
    card = { ...gen.card, source: gen.source };
  }
  return NextResponse.json({ ok: true, eventId, card });
}
