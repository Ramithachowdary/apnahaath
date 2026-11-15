import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashPassword, withSession } from "@/lib/auth";
import { createUser, getUserByEmail, getUserByGoogleId, listUserHouseholds, setUserGoogle } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, appUrl, exchangeGoogleCode, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google users skip the email code (Google verified the email). An existing account with the same verified email is linked. */
export async function GET(req: Request) {
  const base = appUrl();
  const fail = (why: string) => {
    const r = NextResponse.redirect(`${base}/?auth_error=${why}`);
    r.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return r;
  };
  if (!googleConfigured()) return fail("google_unavailable");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const expected = (await cookies()).get(GOOGLE_STATE_COOKIE)?.value ?? "";
  if (!code || !state || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return fail("google_state");
  let profile;
  try {
    profile = await exchangeGoogleCode(code);
  } catch (e) {
    console.error("[google] sign-in failed", e instanceof Error ? e.message : e);
    return fail("google_failed");
  }
  if (!profile.email_verified) return fail("google_unverified");
  let user = await getUserByGoogleId(profile.sub);
  if (!user) {
    const byEmail = await getUserByEmail(profile.email);
    if (byEmail) {
      await setUserGoogle(byEmail.id, profile.sub); // link by verified email (also completes an unfinished email sign-up)
      user = byEmail;
    } else {
      const id = `u-${randomUUID()}`;
      // Random unusable password: this account signs in with Google.
      await createUser({ id, name: profile.name.slice(0, 80), email: profile.email, password_hash: hashPassword(randomBytes(32).toString("hex")), is_demo: 0, email_verified: 1, google_id: profile.sub });
      user = (await getUserByGoogleId(profile.sub))!;
    }
  }
  const hh = await listUserHouseholds(user.id);
  const res = withSession(NextResponse.redirect(`${base}/`), user.id, hh[0]?.id ?? null);
  res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
