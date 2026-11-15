/** Users, email OTP codes and auth metadata (lockouts, rate limits). */
import type { User } from "../types";
import { formatIstIso } from "../time";
import { one, run, type Stmt } from "./driver";

/** Create a user account; the email is stored lower-case. */
export async function createUser(u: Omit<User, "created_at">) {
  await run(
    `INSERT INTO users (id,name,email,password_hash,is_demo,created_at,email_verified,google_id) VALUES (?,?,?,?,?,?,?,?)`,
    [
      u.id,
      u.name,
      u.email.toLowerCase(),
      u.password_hash,
      u.is_demo,
      formatIstIso(),
      u.email_verified ?? 1,
      u.google_id ?? null,
    ],
  );
}
/** Create user (batch statement). */
export const createUserStmt = (u: Omit<User, "created_at">): Stmt => ({
  sql: `INSERT INTO users (id,name,email,password_hash,is_demo,created_at) VALUES (?,?,?,?,?,?)`,
  args: [u.id, u.name, u.email.toLowerCase(), u.password_hash, u.is_demo, formatIstIso()],
});
/** Set user verified. */
export async function setUserVerified(id: string) {
  await run(`UPDATE users SET email_verified = 1 WHERE id = ?`, [id]);
}
/** Set user google. */
export async function setUserGoogle(id: string, googleId: string) {
  await run(`UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?`, [googleId, id]);
}
/** Update unverified user. */
export async function updateUnverifiedUser(id: string, name: string, passwordHash: string) {
  await run(`UPDATE users SET name = ?, password_hash = ? WHERE id = ? AND email_verified = 0`, [
    name,
    passwordHash,
    id,
  ]);
}
/** Get user by google id. */
export async function getUserByGoogleId(googleId: string) {
  return one<User>(`SELECT * FROM users WHERE google_id = ?`, [googleId]);
}
/** Otp row. */
export type OtpRow = { user_id: string; code_hash: string; expires_at: number; attempts: number; last_sent_at: number };
/** Get otp. */
export async function getOtp(userId: string) {
  const r = await one<OtpRow>(`SELECT * FROM email_otps WHERE user_id = ?`, [userId]);
  return r
    ? { ...r, expires_at: Number(r.expires_at), last_sent_at: Number(r.last_sent_at), attempts: Number(r.attempts) }
    : undefined;
}
/** Upsert otp. */
export async function upsertOtp(userId: string, codeHash: string, expiresAt: number, now: number) {
  await run(
    `INSERT INTO email_otps (user_id,code_hash,expires_at,attempts,last_sent_at) VALUES (?,?,?,0,?)
    ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, last_sent_at = excluded.last_sent_at`,
    [userId, codeHash, expiresAt, now],
  );
}
/** Bump otp attempts. */
export async function bumpOtpAttempts(userId: string) {
  await run(`UPDATE email_otps SET attempts = attempts + 1 WHERE user_id = ?`, [userId]);
}
/** Delete otp. */
export async function deleteOtp(userId: string) {
  await run(`DELETE FROM email_otps WHERE user_id = ?`, [userId]);
}
/** Get user by email. */
export async function getUserByEmail(email: string) {
  return one<User>(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()]);
}
/** Get user. */
export async function getUser(id: string) {
  return one<User>(`SELECT * FROM users WHERE id = ?`, [id]);
}

// ---------- meta (lockouts, rate limits) ----------
/** Read one auth metadata value (lockouts, rate-limit windows); empty string when unset. */
export async function getAuthMeta(key: string): Promise<string> {
  return (await one<{ value: string }>(`SELECT value FROM auth_meta WHERE key = ?`, [key]))?.value ?? "";
}
/** Set auth meta. */
export async function setAuthMeta(key: string, value: string) {
  await run(`INSERT INTO auth_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [
    key,
    value,
  ]);
}
