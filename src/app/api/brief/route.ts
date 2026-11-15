import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { generateDoctorBrief } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  return NextResponse.json({ brief: await generateDoctorBrief(a.ctx.household.id, a.ctx.household.elder_name) });
}
