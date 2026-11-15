import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { insertDecisionCard } from "@/lib/db";
import { generateDecisionCard } from "@/lib/gemini";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live Gemini generation only on an explicit button press. */
export async function POST(req: Request) {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const p = await parseBody(
    req,
    z.object({ context: z.string().max(500).optional(), medicineHint: z.string().max(80).optional() }),
  );
  if ("error" in p) return p.error;
  const gen = await generateDecisionCard({
    hh: a.ctx.household.id,
    sourceEventId: null,
    context: p.data.context ?? "Weekly safety review",
    medicineHint: p.data.medicineHint,
  });
  await insertDecisionCard(gen.card);
  return NextResponse.json({ card: gen.card, source: gen.source });
}
