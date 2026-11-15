import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withSession } from "@/lib/auth";
import { getMembership } from "@/lib/db";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await requireUser();
  if ("error" in u) return u.error;
  const p = await parseBody(req, z.object({ householdId: z.string().max(80) }));
  if ("error" in p) return p.error;
  if (!(await getMembership(u.user.id, p.data.householdId))) {
    return NextResponse.json({ error: "Not a member of this care circle" }, { status: 403 });
  }
  return withSession(NextResponse.json({ ok: true }), u.user.id, p.data.householdId);
}
