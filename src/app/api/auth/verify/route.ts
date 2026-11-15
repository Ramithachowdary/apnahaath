import { NextResponse } from "next/server";
import { z } from "zod";
import { withSession } from "@/lib/auth";
import { getUserByEmail, listUserHouseholds } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(120), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

/** Step 2 of sign-up: check the emailed code, mark the email verified and sign in. */
export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientIp(req)}`, 30, 10 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  const p = await parseBody(req, Body);
  if ("error" in p) return p.error;
  const user = await getUserByEmail(p.data.email);
  if (!user) return NextResponse.json({ error: "No code is waiting. Ask for a new code." }, { status: 400 });
  if (user.email_verified !== 0) return NextResponse.json({ error: "This email is already verified. Please sign in." }, { status: 409 });
  const r = await verifyOtp(user.id, p.data.code);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const hh = await listUserHouseholds(user.id);
  return withSession(NextResponse.json({ ok: true, name: user.name }), user.id, hh[0]?.id ?? null);
}
