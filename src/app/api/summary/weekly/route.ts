import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { generateWeeklySummary } from "@/lib/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Weekly care summary for any member of the active care circle (read-only). */
export async function POST() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const r = await generateWeeklySummary(a.ctx.household.id, a.ctx.household.elder_name);
  return NextResponse.json({ stats: r.stats, summary: r.summary, source: r.source, disclaimer: r.disclaimer });
}
