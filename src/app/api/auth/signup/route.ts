import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, withSession } from "@/lib/auth";
import { createUser, getUserByEmail } from "@/lib/db";
import { parseBody, shortText } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: shortText(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: Request) {
  const p = await parseBody(req, Body);
  if ("error" in p) return p.error;
  const { name, email, password } = p.data;
  if (email.endsWith("@demo.apnahaath.app")) {
    return NextResponse.json({ error: "This email domain is reserved for demo accounts" }, { status: 400 });
  }
  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
  }
  const id = `u-${randomUUID()}`;
  await createUser({ id, name, email, password_hash: hashPassword(password), is_demo: 0 });
  return withSession(NextResponse.json({ ok: true, user: { id, name, email } }), id, null);
}
