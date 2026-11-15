import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { createUser, getUserByEmail, updateUnverifiedUser } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { parseBody, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: shortText(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

/** Step 1 of sign-up: create an unverified account and email a 6-digit code. No session until the code is verified. */
export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many sign-ups from this network. Please try again in a few minutes." },
      { status: 429 },
    );
  }
  const p = await parseBody(req, Body);
  if ("error" in p) return p.error;
  const { name, email, password } = p.data;
  const existing = await getUserByEmail(email);
  let id: string;
  if (existing) {
    if (existing.email_verified !== 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }
    id = existing.id; // unfinished sign-up: refresh details and send a new code
    await updateUnverifiedUser(id, name, hashPassword(password));
  } else {
    id = `u-${randomUUID()}`;
    await createUser({ id, name, email, password_hash: hashPassword(password), is_demo: 0, email_verified: 0 });
  }
  const r = await issueOtp(id, email, name);
  if (!r.ok)
    return NextResponse.json(
      { error: r.error, needsVerification: true, email, retryAfterS: r.retryAfterS },
      { status: r.status },
    );
  return NextResponse.json({
    ok: true,
    needsVerification: true,
    email,
    emailSent: r.sent,
    ...(r.devCode ? { devCode: r.devCode } : {}),
  });
}
