import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { newInviteCode, requireMember } from "@/lib/auth";
import { insertInvite, listInvites } from "@/lib/db";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVITE_HOURS = 48;

export async function GET() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  if (a.ctx.household.owner_user_id !== a.ctx.user.id) return NextResponse.json({ invites: [] });
  return NextResponse.json({ invites: await listInvites(a.ctx.household.id) });
}

/** Owner creates a single-use, expiring invite. Only the hash is stored; the code is shown once. */
export async function POST(req: Request) {
  const a = await requireMember();
  if ("error" in a) return a.error;
  if (a.ctx.household.owner_user_id !== a.ctx.user.id) {
    return NextResponse.json({ error: "Only the care circle owner can invite people" }, { status: 403 });
  }
  const p = await parseBody(req, z.object({ role: z.enum(["elder", "caretaker", "family"]) }));
  if ("error" in p) return p.error;
  const { code, hash } = newInviteCode();
  const expires = new Date(Date.now() + INVITE_HOURS * 3600_000).toISOString();
  await insertInvite({
    id: `inv-${randomUUID()}`,
    household_id: a.ctx.household.id,
    role: p.data.role,
    code_hash: hash,
    created_by: a.ctx.user.id,
    expires_at: expires,
  });
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    code,
    role: p.data.role,
    expiresAt: expires,
    link: `${origin}/?invite=${code}`,
  });
}
