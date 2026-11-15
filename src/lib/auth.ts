import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LOCKOUT_MAX_ATTEMPTS, LOCKOUT_MINUTES, SESSION_COOKIE } from "./constants";
import {
  getAuthMeta,
  getHousehold,
  getMembership,
  getMembershipById,
  getUser,
  getUserByEmail,
  setAuthMeta,
  setMembershipLock,
} from "./db";
import type { Household, Membership, Role, User } from "./types";

/** Cookie payload: who is signed in and which household is active. Role is never trusted from the cookie. */
export interface Session {
  uid: string;
  hid: string | null;
  iat: number;
}

const SESSION_MAX_AGE_S = 60 * 60 * 8;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET env var (min 16 chars) is required in production");
  }
  return "apnahaath-local-dev-secret"; // local dev only
}

function sign(payloadB64: string): string {
  return createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
}

function encode(session: Session): string {
  const p = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${p}.${sign(p)}`;
}

function decode(raw: string | undefined): Session | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(sign(parts[0]));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const s = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Session;
    if (!s || typeof s.uid !== "string" || typeof s.iat !== "number") return null;
    if (Date.now() / 1000 - s.iat > SESSION_MAX_AGE_S) return null;
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decode(jar.get(SESSION_COOKIE)?.value);
}

export interface Ctx {
  user: User;
  household: Household;
  membership: Membership;
  role: Role;
}

/** Signed-in user (no household needed). */
export async function requireUser(): Promise<{ user: User; session: Session } | { error: NextResponse }> {
  const session = await getSession();
  const user = session ? await getUser(session.uid) : undefined;
  if (!session || !user) return { error: NextResponse.json({ error: "Please sign in" }, { status: 401 }) };
  return { user, session };
}

/** Signed-in user + membership of the active household (+ optional role check). Server-side only. */
export async function requireMember(allowed?: Role[]): Promise<{ ctx: Ctx } | { error: NextResponse }> {
  const u = await requireUser();
  if ("error" in u) return u;
  const hid = u.session.hid;
  const household = hid ? await getHousehold(hid) : undefined;
  const membership = hid ? await getMembership(u.user.id, hid) : undefined;
  if (!household || !membership) {
    return { error: NextResponse.json({ error: "Not a member of this care circle" }, { status: 403 }) };
  }
  if (allowed && !allowed.includes(membership.role)) {
    return { error: NextResponse.json({ error: "Your role cannot do this" }, { status: 403 }) };
  }
  return { ctx: { user: u.user, household, membership, role: membership.role } };
}

// ---------- password login with per-email lockout ----------
export async function isLoginLocked(email: string): Promise<boolean> {
  const until = await getAuthMeta(`login_lock:${email.toLowerCase()}`);
  return Boolean(until && Date.parse(until) > Date.now());
}

export async function verifyLogin(
  email: string,
  password: string,
): Promise<{ ok: true; user: User } | { ok: false; reason: string; status: number }> {
  const key = email.toLowerCase();
  if (await isLoginLocked(key))
    return { ok: false, reason: "Too many attempts. Try again in a few minutes.", status: 429 };
  const user = await getUserByEmail(key);
  const okPw = user ? bcrypt.compareSync(password, user.password_hash) : false;
  if (!user || !okPw) {
    const n = Number((await getAuthMeta(`login_fail:${key}`)) || "0") + 1;
    await setAuthMeta(`login_fail:${key}`, String(n));
    if (n >= LOCKOUT_MAX_ATTEMPTS) {
      await setAuthMeta(`login_lock:${key}`, new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString());
      await setAuthMeta(`login_fail:${key}`, "0");
    }
    return { ok: false, reason: "Wrong email or password", status: 401 };
  }
  await setAuthMeta(`login_fail:${key}`, "0");
  return { ok: true, user };
}

// ---------- per-membership confirmation PIN (re-auth before authoring) ----------
export async function verifyPin(
  membershipId: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const m = await getMembershipById(membershipId);
  if (!m) return { ok: false, reason: "Unknown membership" };
  if (m.lockout_until && Date.parse(m.lockout_until) > Date.now()) {
    return {
      ok: false,
      reason: `Locked after ${LOCKOUT_MAX_ATTEMPTS} wrong PINs. Try again in ${LOCKOUT_MINUTES} minutes.`,
    };
  }
  if (!bcrypt.compareSync(pin, m.pin_hash)) {
    const n = Number(m.failed_attempts) + 1;
    if (n >= LOCKOUT_MAX_ATTEMPTS) {
      await setMembershipLock(m.id, 0, new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString());
    } else {
      await setMembershipLock(m.id, n, null);
    }
    return { ok: false, reason: "Wrong PIN" };
  }
  await setMembershipLock(m.id, 0, null);
  return { ok: true };
}

export async function requirePin(ctx: Ctx, pin: string): Promise<{ ok: true } | { error: NextResponse }> {
  const r = await verifyPin(ctx.membership.id, pin);
  if (!r.ok) return { error: NextResponse.json({ error: r.reason }, { status: 401 }) };
  return { ok: true };
}

// ---------- cookies ----------
export function sessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_S) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function withSession(res: NextResponse, uid: string, hid: string | null): NextResponse {
  res.cookies.set(SESSION_COOKIE, encode({ uid, hid, iat: Math.floor(Date.now() / 1000) }), sessionCookieOptions());
  return res;
}

export function buildLogoutResponse(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

export function newInviteCode(): { code: string; hash: string } {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return { code, hash: hashInviteCode(code) };
}

export function hashInviteCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/** Exported for tests */
export const __test = { encode, decode };
