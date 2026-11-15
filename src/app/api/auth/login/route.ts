import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyLogin, withSession } from "@/lib/auth";
import { listUserHouseholds } from "@/lib/db";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const p = await parseBody(req, Body);
  if ("error" in p) return p.error;
  const r = await verifyLogin(p.data.email, p.data.password);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.status });
  if (r.user.email_verified === 0) {
    return NextResponse.json(
      {
        error: "Please verify your email first. Enter the 6-digit code we sent you.",
        needsVerification: true,
        email: r.user.email,
      },
      { status: 403 },
    );
  }
  const hh = await listUserHouseholds(r.user.id);
  return withSession(NextResponse.json({ ok: true, name: r.user.name }), r.user.id, hh[0]?.id ?? null);
}
