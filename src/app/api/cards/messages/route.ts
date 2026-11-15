import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCareMessages } from "@/lib/adaption";
import { requireMember } from "@/lib/auth";
import { getDecisionCard } from "@/lib/db";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Care Communication Engine: Adaption rewrites a validated card into role-specific messages. */
export async function POST(req: Request) {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const p = await parseBody(req, z.object({ cardId: z.string().max(120) }));
  if ("error" in p) return p.error;
  const card = await getDecisionCard(a.ctx.household.id, p.data.cardId);
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  const r = await generateCareMessages(card, a.ctx.household.elder_name);
  return NextResponse.json({ messages: r.messages, source: r.source });
}
