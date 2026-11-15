import { createHash, randomInt, timingSafeEqual } from "crypto";
import { bumpOtpAttempts, deleteOtp, getOtp, setUserVerified, upsertOtp } from "./db";
import { sendEmail } from "./email";

/** Email sign-up codes: 6 digits, stored only as a SHA-256 hash, 10-minute expiry, 5 attempts, 60 s resend cooldown. */
export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export type IssueResult =
  { ok: true; sent: boolean; devCode?: string } | { ok: false; status: number; error: string; retryAfterS?: number };

export async function issueOtp(userId: string, email: string, name: string, now = Date.now()): Promise<IssueResult> {
  const existing = await getOtp(userId);
  if (existing && now - existing.last_sent_at < OTP_RESEND_COOLDOWN_MS) {
    const retryAfterS = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.last_sent_at)) / 1000);
    return {
      ok: false,
      status: 429,
      error: `Please wait ${retryAfterS} seconds before asking for a new code.`,
      retryAfterS,
    };
  }
  const code = generateOtp();
  await upsertOtp(userId, hash(code), now + OTP_TTL_MS, now);
  const r = await sendEmail(
    email,
    "Your ApnaHaath verification code",
    [
      `Hello ${name},`,
      "",
      `Your ApnaHaath verification code is: ${code}`,
      "",
      "It expires in 10 minutes. If you did not sign up, you can ignore this email.",
      "",
      "— ApnaHaath (a care log, not a doctor). Emergency: call 108.",
    ].join("\n"),
  );
  // The code is never returned in production; tests and local dev without SMTP get it back to finish sign-up.
  const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
  if (!r.sent && process.env.NODE_ENV === "production") {
    return { ok: false, status: 502, error: "We could not send the code email. Please try again in a minute." };
  }
  return { ok: true, sent: r.sent, devCode };
}

export type VerifyResult = { ok: true } | { ok: false; status: number; error: string };

export async function verifyOtp(userId: string, code: string, now = Date.now()): Promise<VerifyResult> {
  const row = await getOtp(userId);
  if (!row) return { ok: false, status: 400, error: "No code is waiting. Ask for a new code." };
  if (now > row.expires_at) return { ok: false, status: 400, error: "This code has expired. Ask for a new code." };
  if (row.attempts >= OTP_MAX_ATTEMPTS)
    return { ok: false, status: 429, error: "Too many wrong codes. Ask for a new code." };
  const a = Buffer.from(hash(code.trim()), "hex");
  const b = Buffer.from(row.code_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await bumpOtpAttempts(userId);
    const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
    return {
      ok: false,
      status: 400,
      error: left > 0 ? `That code is not right. ${left} tries left.` : "Too many wrong codes. Ask for a new code.",
    };
  }
  await deleteOtp(userId);
  await setUserVerified(userId);
  return { ok: true };
}
