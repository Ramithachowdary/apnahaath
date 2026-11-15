import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "test-session-secret-32chars!!";

vi.mock("../src/lib/db", () => ({
  getDoseSlot: vi.fn(),
  getMedicine: vi.fn(),
  getMembership: vi.fn(),
  getUser: vi.fn(),
  insertEvent: vi.fn(),
  query: vi.fn(),
  updateDoseSlotStatus: vi.fn(),
}));

import {
  getDoseSlot,
  getMedicine,
  getMembership,
  getUser,
  insertEvent,
  query,
  updateDoseSlotStatus,
} from "../src/lib/db";
import { createDoseToken, redeemDoseToken, verifyDoseToken, DOSE_LINK_TTL_S } from "../src/lib/doselink";

const membership = vi.mocked(getMembership);
const slotFn = vi.mocked(getDoseSlot);
const med = vi.mocked(getMedicine);
const user = vi.mocked(getUser);
const event = vi.mocked(insertEvent);
const q = vi.mocked(query);
const update = vi.mocked(updateDoseSlotStatus);

const payload = { hid: "hh", sid: "slot-1", uid: "elder-1", role: "elder" as const };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-session-secret-32chars!!";
  membership.mockReset();
  slotFn.mockReset();
  med.mockReset().mockResolvedValue({ name: "Telma 40" } as never);
  user.mockReset().mockResolvedValue({ name: "Kamla Devi" } as never);
  event.mockReset().mockResolvedValue(undefined);
  q.mockReset().mockResolvedValue({ rowCount: 1, rows: [] });
  update.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  process.env.SESSION_SECRET = "test-session-secret-32chars!!";
});

describe("createDoseToken and verifyDoseToken", () => {
  it("round-trips a signed token bound to one person, household and slot", () => {
    const now = 1_700_000_000;
    const token = createDoseToken(payload, DOSE_LINK_TTL_S, now);
    const v = verifyDoseToken(token, now + 60);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload).toMatchObject({ v: 1, ...payload });
      expect(v.payload.exp).toBe(now + DOSE_LINK_TTL_S);
      expect(v.payload.n).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });

  it.each(["", "nodot", ".", "a.", ".b", "a.b.c"])("rejects a malformed token: %s", (token) => {
    expect(verifyDoseToken(token)).toEqual({ ok: false, reason: "This link is not valid." });
  });

  it("rejects a token that is too long", () => {
    const token = `${"a".repeat(600)}.${"b".repeat(601)}`;
    expect(verifyDoseToken(token)).toEqual({ ok: false, reason: "This link is not valid." });
  });

  it("rejects a tampered payload and an expired token", () => {
    const token = createDoseToken(payload);
    const [p, s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), uid: "other" }),
    ).toString("base64url");
    expect(verifyDoseToken(`${forged}.${s}`).ok).toBe(false);
    const expired = createDoseToken(payload, 60, Date.now() / 1000 - 120);
    expect(verifyDoseToken(expired)).toEqual({
      ok: false,
      reason: "This link has expired. Please open the app instead.",
    });
  });

  it("rejects a payload with the wrong version or invalid JSON (valid signature, bad body)", () => {
    const token = createDoseToken(payload);
    const sig = token.split(".")[1];
    const badVer = Buffer.from(JSON.stringify({ v: 2, exp: Date.now() / 1000 + 60, ...payload, n: "n" })).toString(
      "base64url",
    );
    expect(verifyDoseToken(`${badVer}.${sig}`).ok).toBe(false);
    const badJson = Buffer.from("not-json").toString("base64url");
    expect(verifyDoseToken(`${badJson}.${sig}`)).toEqual({ ok: false, reason: "This link is not valid." });
  });

  it("throws in production when SESSION_SECRET is missing", () => {
    const prev = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    expect(() => createDoseToken(payload)).toThrow(/SESSION_SECRET/);
    (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    process.env.SESSION_SECRET = "test-session-secret-32chars!!";
  });
});

describe("redeemDoseToken", () => {
  const pending = {
    id: "slot-1",
    household_id: "hh",
    medicine_id: "med-1",
    scheduled_at: "2026-11-15T08:00:00+05:30",
    status: "pending" as const,
    skip_reason: null,
  };

  it("returns the verify failure for a bad token", async () => {
    expect(await redeemDoseToken("not-a-token")).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a link when the member is gone or the role no longer matches", async () => {
    membership.mockResolvedValue(undefined);
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({ ok: false, status: 403 });
    membership.mockResolvedValue({ role: "family" } as never);
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({ ok: false, status: 403 });
  });

  it("returns 404 when the dose slot is missing", async () => {
    membership.mockResolvedValue({ role: "elder" } as never);
    slotFn.mockResolvedValue(undefined);
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects an elder link for a skipped or already-taken dose", async () => {
    membership.mockResolvedValue({ role: "elder" } as never);
    slotFn.mockResolvedValue({ ...pending, status: "skipped" });
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({
      ok: false,
      status: 409,
      reason: "This dose was already marked as skipped.",
    });
    slotFn.mockResolvedValue({ ...pending, status: "elder_confirmed" });
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({
      ok: false,
      status: 409,
      reason: "This dose was already marked as taken.",
    });
  });

  it("rejects a link that was already used", async () => {
    membership.mockResolvedValue({ role: "elder" } as never);
    slotFn.mockResolvedValue(pending);
    q.mockResolvedValue({ rowCount: 0, rows: [] });
    expect(await redeemDoseToken(createDoseToken(payload))).toMatchObject({
      ok: false,
      status: 409,
      reason: "This link was already used.",
    });
  });

  it("marks the dose taken when the elder redeems her own link", async () => {
    membership.mockResolvedValue({ role: "elder" } as never);
    slotFn.mockResolvedValue(pending);
    const r = await redeemDoseToken(createDoseToken(payload));
    expect(r).toEqual({ ok: true, outcome: "elder_confirmed", medicine: "Telma 40" });
    expect(update).toHaveBeenCalledWith("hh", "slot-1", "elder_confirmed", null);
    expect(event).toHaveBeenCalledWith(
      "hh",
      expect.objectContaining({ type: "elder_confirmed", actor_role: "elder", actor_name: "Kamla Devi" }),
    );
  });

  it("records a witness only for a caretaker or family link and never marks the dose taken", async () => {
    membership.mockResolvedValue({ role: "caretaker" } as never);
    slotFn.mockResolvedValue(pending);
    user.mockResolvedValue({ name: "Sunita" } as never);
    med.mockResolvedValue(undefined);
    const token = createDoseToken({ hid: "hh", sid: "slot-1", uid: "care-1", role: "caretaker" });
    const r = await redeemDoseToken(token);
    expect(r).toEqual({ ok: true, outcome: "witnessed", medicine: "medicine" });
    expect(update).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith(
      "hh",
      expect.objectContaining({ type: "witnessed", actor_role: "caretaker", actor_name: "Sunita" }),
    );
  });
});
