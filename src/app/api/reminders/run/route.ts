import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";
import { listOutbox } from "@/lib/db";
import { runMorningCheck } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const result = await runMorningCheck(a.ctx.household.id);
  return NextResponse.json({ ...result, outbox: await listOutbox(a.ctx.household.id) });
}
