import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, appUrl, googleAuthUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts Google sign-in. Always runs on the fixed APP_URL host so the state cookie and the session land on the same site as the callback. */
export async function GET(req: Request) {
  const base = appUrl();
  if (!googleConfigured()) return NextResponse.redirect(`${base}/signin?auth_error=google_unavailable`);
  if (new URL(req.url).host !== new URL(base).host) return NextResponse.redirect(`${base}/api/auth/google`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(state));
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
