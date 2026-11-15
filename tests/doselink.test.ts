import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOSE_LINK_TTL_S, createDoseToken, verifyDoseToken } from "../src/lib/doselink";

const base = { hid: "hh-1", sid: "slot-1", uid: "user-elder", role: "elder" as const };

describe("createDoseToken / verifyDoseToken", () => {
  const prevSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "unit-test-session-secret";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  });

  it("signs a token bound to household, slot, user and role", () => {
    const now = 1_700_000_000;
    const token = createDoseToken(base, DOSE_LINK_TTL_S, now);
    const verified = verifyDoseToken(token, now + 10);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.payload).toMatchObject({ v: 1, ...base });
    expect(verified.payload.exp).toBe(now + DOSE_LINK_TTL_S);
    expect(verified.payload.n).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("issues a unique nonce each time", () => {
    const a = verifyDoseToken(createDoseToken(base, 60, 1000), 1000);
    const b = verifyDoseToken(createDoseToken(base, 60, 1000), 1000);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.payload.n).not.toBe(b.payload.n);
  });

  it("accepts a token at the expiry instant and rejects one a second later", () => {
    const now = 1_700_000_000;
    const token = createDoseToken(base, 60, now);
    expect(verifyDoseToken(token, now + 60).ok).toBe(true);
    expect(verifyDoseToken(token, now + 61)).toEqual({
      ok: false,
      reason: "This link has expired. Please open the app instead.",
    });
  });

  it.each(["", "nodot", "....", "abc.def.ghi"])("rejects malformed token %s", (token) => {
    expect(verifyDoseToken(token).ok).toBe(false);
  });

  it("rejects a token longer than 1200 characters", () => {
    const token = `${"a".repeat(600)}.${"b".repeat(601)}`;
    expect(verifyDoseToken(token)).toEqual({ ok: false, reason: "This link is not valid." });
  });

  it("rejects a tampered payload and a tampered signature", () => {
    const token = createDoseToken(base, 60, 1000);
    const [payload, sig] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ v: 1, ...base, uid: "intruder", exp: 2000, n: "n" })).toString(
      "base64url",
    );
    expect(verifyDoseToken(`${evil}.${sig}`, 1000).ok).toBe(false);
    expect(verifyDoseToken(`${payload}.${sig.slice(0, -2)}aa`, 1000).ok).toBe(false);
  });

  it("rejects an unexpected payload version", () => {
    const token = createDoseToken(base, 60, 1000);
    const sig = token.split(".")[1];
    const v2 = Buffer.from(JSON.stringify({ v: 2, ...base, exp: 10_000, n: "n" })).toString("base64url");
    // Signature will not match either, which is also a reject.
    expect(verifyDoseToken(`${v2}.${sig}`, 1000).ok).toBe(false);
  });

  it("can mint a caretaker witness token and a custom ttl", () => {
    const now = 50;
    const token = createDoseToken({ ...base, uid: "c1", role: "caretaker" }, 30, now);
    const verified = verifyDoseToken(token, now + 1);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.payload.role).toBe("caretaker");
      expect(verified.payload.exp).toBe(80);
    }
  });
});
