import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getOtp: vi.fn(),
  upsertOtp: vi.fn(),
  bumpOtpAttempts: vi.fn(),
  deleteOtp: vi.fn(),
  setUserVerified: vi.fn(),
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("../src/lib/db", () => db);
vi.mock("../src/lib/email", () => mail);

import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, generateOtp, issueOtp, verifyOtp } from "../src/lib/otp";
import { createHash } from "crypto";

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

describe("generateOtp", () => {
  it("returns a 6-digit code in the 100000–999999 range", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("issueOtp", () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    db.getOtp.mockReset();
    db.upsertOtp.mockReset();
    mail.sendEmail.mockReset();
    mail.sendEmail.mockResolvedValue({ sent: true });
    (process.env as { NODE_ENV?: string }).NODE_ENV = "test";
  });

  afterEach(() => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = prevEnv;
  });

  it("stores only a hash, emails the code, and returns a dev code outside production", async () => {
    db.getOtp.mockResolvedValue(undefined);
    const now = 1_700_000_000_000;
    const result = await issueOtp("u1", "elder@example.com", "Kamla", now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sent).toBe(true);
    expect(result.devCode).toMatch(/^\d{6}$/);
    const storedHash = db.upsertOtp.mock.calls[0][1];
    expect(storedHash).toBe(hash(result.devCode!));
    expect(storedHash).not.toContain(result.devCode);
    expect(db.upsertOtp).toHaveBeenCalledWith("u1", storedHash, now + OTP_TTL_MS, now);
    const body = mail.sendEmail.mock.calls[0][2] as string;
    expect(body).toContain(result.devCode);
    expect(mail.sendEmail.mock.calls[0][0]).toBe("elder@example.com");
  });

  it("enforces the 60-second resend cooldown", async () => {
    const now = 1_700_000_000_000;
    db.getOtp.mockResolvedValue({ last_sent_at: now - 15_000, expires_at: now + 60_000, attempts: 0, code_hash: "x" });
    const result = await issueOtp("u1", "e@x.com", "Kamla", now);
    expect(result).toMatchObject({
      ok: false,
      status: 429,
      retryAfterS: Math.ceil((OTP_RESEND_COOLDOWN_MS - 15_000) / 1000),
    });
    expect(db.upsertOtp).not.toHaveBeenCalled();
  });

  it("allows a resend after the cooldown and hides the code in production if SMTP fails", async () => {
    const now = 1_700_000_000_000;
    db.getOtp.mockResolvedValue({
      last_sent_at: now - OTP_RESEND_COOLDOWN_MS - 1,
      expires_at: now,
      attempts: 0,
      code_hash: "x",
    });
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    mail.sendEmail.mockResolvedValue({ sent: false, error: "down" });
    const result = await issueOtp("u1", "e@x.com", "Kamla", now);
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("still issues a code in non-production when SMTP is not configured", async () => {
    db.getOtp.mockResolvedValue(undefined);
    mail.sendEmail.mockResolvedValue({ sent: false, error: "Email is not configured" });
    const result = await issueOtp("u1", "e@x.com", "Kamla");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sent).toBe(false);
  });
});

describe("verifyOtp", () => {
  const code = "123456";
  const now = 1_700_000_000_000;

  beforeEach(() => {
    db.getOtp.mockReset();
    db.bumpOtpAttempts.mockReset();
    db.deleteOtp.mockReset();
    db.setUserVerified.mockReset();
  });

  it("rejects a missing, expired, or exhausted code", async () => {
    db.getOtp.mockResolvedValue(undefined);
    expect(await verifyOtp("u1", code, now)).toMatchObject({ ok: false, status: 400 });

    db.getOtp.mockResolvedValue({ code_hash: hash(code), expires_at: now - 1, attempts: 0, last_sent_at: now });
    expect(await verifyOtp("u1", code, now)).toMatchObject({ ok: false, status: 400 });
    const expired = await verifyOtp("u1", code, now);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error).toMatch(/expired/i);

    db.getOtp.mockResolvedValue({
      code_hash: hash(code),
      expires_at: now + 1000,
      attempts: OTP_MAX_ATTEMPTS,
      last_sent_at: now,
    });
    expect(await verifyOtp("u1", code, now)).toMatchObject({ ok: false, status: 429 });
  });

  it("counts a wrong code and reports tries left", async () => {
    db.getOtp.mockResolvedValue({ code_hash: hash(code), expires_at: now + 1000, attempts: 1, last_sent_at: now });
    const result = await verifyOtp("u1", "000000", now);
    expect(result.ok).toBe(false);
    expect(db.bumpOtpAttempts).toHaveBeenCalledWith("u1");
    if (!result.ok) expect(result.error).toContain(`${OTP_MAX_ATTEMPTS - 2} tries left`);
  });

  it("tells the user to request a new code on the last failed attempt", async () => {
    db.getOtp.mockResolvedValue({
      code_hash: hash(code),
      expires_at: now + 1000,
      attempts: OTP_MAX_ATTEMPTS - 1,
      last_sent_at: now,
    });
    const result = await verifyOtp("u1", "000000", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Too many wrong codes/);
  });

  it("accepts a matching code, even with surrounding whitespace, then deletes it and marks the user verified", async () => {
    db.getOtp.mockResolvedValue({ code_hash: hash(code), expires_at: now + 1000, attempts: 0, last_sent_at: now });
    const result = await verifyOtp("u1", " 123456 ", now);
    expect(result).toEqual({ ok: true });
    expect(db.deleteOtp).toHaveBeenCalledWith("u1");
    expect(db.setUserVerified).toHaveBeenCalledWith("u1");
    expect(db.bumpOtpAttempts).not.toHaveBeenCalled();
  });
});
