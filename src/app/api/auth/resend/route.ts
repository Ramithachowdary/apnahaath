import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { parseBody } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a new code (60 s cooldown per account). The response does not reveal whether the email has an account. */
export async function POST(req: Request) {
  if (!rateLimit(`resend:${clientIp(req)}`, 10, 10 * 60_000))
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });
  const p = await parseBody(req, z.object({ email: z.string().trim().toLowerCase().email().max(120) }));
  if ("error" in p) return p.error;
  const user = await getUserByEmail(p.data.email);
  if (!user || user.email_verified !== 0) return NextResponse.json({ ok: true });
  const r = await issueOtp(user.id, user.email, user.name);
  if (!r.ok) return NextResponse.json({ error: r.error, retryAfterS: r.retryAfterS }, { status: r.status });
  return NextResponse.json({ ok: true, emailSent: r.sent, ...(r.devCode ? { devCode: r.devCode } : {}) });
}
