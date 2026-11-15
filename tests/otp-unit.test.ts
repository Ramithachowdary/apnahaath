import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  bumpOtpAttempts: vi.fn(),
  deleteOtp: vi.fn(),
  getOtp: vi.fn(),
  setUserVerified: vi.fn(),
  upsertOtp: vi.fn(),
}));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(),
}));

import { bumpOtpAttempts, deleteOtp, getOtp, setUserVerified, upsertOtp } from "../src/lib/db";
import { sendEmail } from "../src/lib/email";
import { generateOtp, issueOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, verifyOtp } from "../src/lib/otp";
import { createHash } from "crypto";

const get = vi.mocked(getOtp);
const upsert = vi.mocked(upsertOtp);
const bump = vi.mocked(bumpOtpAttempts);
const del = vi.mocked(deleteOtp);
const verified = vi.mocked(setUserVerified);
const mail = vi.mocked(sendEmail);

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

beforeEach(() => {
  get.mockReset();
  upsert.mockReset().mockResolvedValue(undefined);
  bump.mockReset().mockResolvedValue(undefined);
  del.mockReset().mockResolvedValue(undefined);
  verified.mockReset().mockResolvedValue(undefined);
  mail.mockReset().mockResolvedValue({ sent: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateOtp", () => {
  it("returns a 6-digit code in the 100000-999999 range", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    }
  });
});

describe("issueOtp", () => {
  it("enforces the 60 second resend cooldown", async () => {
    const now = 1_700_000_000_000;
    get.mockResolvedValue({
      user_id: "u1",
      code_hash: "abc",
      expires_at: now + OTP_TTL_MS,
      attempts: 0,
      last_sent_at: now - 20_000,
    });
    const r = await issueOtp("u1", "a@example.com", "Ada", now);
    expect(r).toMatchObject({ ok: false, status: 429, retryAfterS: 40 });
    if (!r.ok) expect(r.error).toMatch(/wait 40 seconds/);
    expect(mail).not.toHaveBeenCalled();
  });

  it("issues a hashed code, emails it, and returns a devCode outside production", async () => {
    get.mockResolvedValue(undefined);
    const now = 1_700_000_000_000;
    const r = await issueOtp("u1", "a@example.com", "Ada", now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sent).toBe(true);
      expect(r.devCode).toMatch(/^\d{6}$/);
      expect(upsert).toHaveBeenCalledWith("u1", hash(r.devCode!), now + OTP_TTL_MS, now);
      const [, subject, body] = mail.mock.calls[0];
      expect(subject).toMatch(/verification code/);
      expect(body).toContain(`Hello Ada`);
      expect(body).toContain(r.devCode);
      expect(body).toMatch(/108/);
    }
  });

  it("does not return the code in production when the email is sent", async () => {
    get.mockResolvedValue(undefined);
    const prev = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const r = await issueOtp("u1", "a@example.com", "Ada");
    (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.devCode).toBeUndefined();
  });

  it("returns 502 in production when the email cannot be sent", async () => {
    get.mockResolvedValue(undefined);
    mail.mockResolvedValue({ sent: false, error: "Email is not configured" });
    const prev = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const r = await issueOtp("u1", "a@example.com", "Ada");
    (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    expect(r).toMatchObject({ ok: false, status: 502 });
  });

  it("still returns the devCode outside production if SMTP is not configured", async () => {
    get.mockResolvedValue(undefined);
    mail.mockResolvedValue({ sent: false, error: "Email is not configured" });
    const r = await issueOtp("u1", "a@example.com", "Ada");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sent).toBe(false);
      expect(r.devCode).toMatch(/^\d{6}$/);
    }
  });
});

describe("verifyOtp", () => {
  const now = 1_700_000_000_000;
  const code = "123456";
  const row = {
    user_id: "u1",
    code_hash: hash(code),
    expires_at: now + OTP_TTL_MS,
    attempts: 0,
    last_sent_at: now,
  };

  it("rejects when no code is waiting", async () => {
    get.mockResolvedValue(undefined);
    expect(await verifyOtp("u1", code, now)).toMatchObject({
      ok: false,
      status: 400,
      error: expect.stringMatching(/No code/),
    });
  });

  it("rejects an expired code", async () => {
    get.mockResolvedValue({ ...row, expires_at: now - 1 });
    expect(await verifyOtp("u1", code, now)).toMatchObject({
      ok: false,
      status: 400,
      error: expect.stringMatching(/expired/),
    });
  });

  it("rejects after too many attempts even with the right code", async () => {
    get.mockResolvedValue({ ...row, attempts: OTP_MAX_ATTEMPTS });
    expect(await verifyOtp("u1", code, now)).toMatchObject({ ok: false, status: 429 });
  });

  it("counts a wrong code and says how many tries are left", async () => {
    get.mockResolvedValue({ ...row, attempts: 1 });
    const r = await verifyOtp("u1", "000000", now);
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/3 tries left/);
    expect(bump).toHaveBeenCalledWith("u1");
  });

  it("says to ask for a new code on the last wrong try", async () => {
    get.mockResolvedValue({ ...row, attempts: OTP_MAX_ATTEMPTS - 1 });
    const r = await verifyOtp("u1", "000000", now);
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/Too many wrong codes/);
  });

  it("accepts a correct code, including surrounding whitespace, and marks the user verified", async () => {
    get.mockResolvedValue(row);
    const r = await verifyOtp("u1", "  123456  ", now);
    expect(r).toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith("u1");
    expect(verified).toHaveBeenCalledWith("u1");
  });
});
