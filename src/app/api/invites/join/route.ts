import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashInviteCode, requireUser, withSession } from "@/lib/auth";
import { addMembershipStmt, batch, consumeInvite, getInviteByHash, getMembership, householdHasRole, insertEventStmt } from "@/lib/db";
import { parseBody, pin } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Join a care circle with an invite code. Role comes from the invite (server-side), never from the client. */
export async function POST(req: Request) {
  const u = await requireUser();
  if ("error" in u) return u.error;
  const p = await parseBody(req, z.object({ code: z.string().trim().min(6).max(20), pin }));
  if ("error" in p) return p.error;
  const inv = await getInviteByHash(hashInviteCode(p.data.code));
  if (!inv || inv.used_by || Date.parse(inv.expires_at) < Date.now()) {
    return NextResponse.json({ error: "This invite code is invalid, used, or expired" }, { status: 400 });
  }
  if (await getMembership(u.user.id, inv.household_id)) {
    return NextResponse.json({ error: "You are already in this care circle" }, { status: 409 });
  }
  if (inv.role === "elder" && (await householdHasRole(inv.household_id, "elder"))) {
    return NextResponse.json({ error: "This care circle already has an elder" }, { status: 409 });
  }
  if (!(await consumeInvite(inv.id, u.user.id))) {
    return NextResponse.json({ error: "This invite code was just used" }, { status: 409 });
  }
  await batch([
    addMembershipStmt({ id: `ms-${randomUUID()}`, user_id: u.user.id, household_id: inv.household_id, role: inv.role, pin_hash: bcrypt.hashSync(p.data.pin, 10) }),
    insertEventStmt(inv.household_id, { id: `evt-${randomUUID()}`, type: "member_joined", actor_role: inv.role, actor_name: u.user.name, payload: { role: inv.role } }),
  ]);
  return withSession(NextResponse.json({ ok: true, householdId: inv.household_id, role: inv.role }), u.user.id, inv.household_id);
}
