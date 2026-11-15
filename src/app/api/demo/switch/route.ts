import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember, withSession } from "@/lib/auth";
import { listMembers } from "@/lib/db";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Demo households only: jump between the three demo accounts so judges can see every role. */
export async function POST(req: Request) {
  const a = await requireMember();
  if ("error" in a) return a.error;
  if (!a.ctx.household.is_demo) return NextResponse.json({ error: "Only available in demo care circles" }, { status: 403 });
  const p = await parseBody(req, z.object({ role: z.enum(["elder", "caretaker", "family"]) }));
  if ("error" in p) return p.error;
  const target = (await listMembers(a.ctx.household.id)).find((m) => m.role === p.data.role && m.is_demo);
  if (!target) return NextResponse.json({ error: "No demo member with that role" }, { status: 404 });
  return withSession(NextResponse.json({ ok: true, name: target.name }), target.id, a.ctx.household.id);
}
