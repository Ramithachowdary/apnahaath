import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCKOUT_MAX_ATTEMPTS, SESSION_COOKIE } from "../src/lib/constants";

const db = vi.hoisted(() => ({
  getAuthMeta: vi.fn(),
  setAuthMeta: vi.fn(),
  getUserByEmail: vi.fn(),
  getUser: vi.fn(),
  getHousehold: vi.fn(),
  getMembership: vi.fn(),
  getMembershipById: vi.fn(),
  setMembershipLock: vi.fn(),
}));

vi.mock("../src/lib/db", () => db);

import {
  __test,
  hashInviteCode,
  hashPassword,
  isLoginLocked,
  newInviteCode,
  sessionCookieOptions,
  verifyLogin,
} from "../src/lib/auth";

const { encode, decode } = __test;

describe("HMAC session cookies", () => {
  const prevSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "unit-test-session-secret";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  });

  it("round-trips a session with a household", () => {
    const raw = encode({ uid: "user-1", hid: "hh-1", iat: Math.floor(Date.now() / 1000) });
    expect(raw.split(".")).toHaveLength(2);
    expect(decode(raw)).toMatchObject({ uid: "user-1", hid: "hh-1" });
  });

  it("round-trips a session with no active household", () => {
    const raw = encode({ uid: "user-2", hid: null, iat: Math.floor(Date.now() / 1000) });
    expect(decode(raw)?.hid).toBeNull();
  });

  it.each(["", undefined, "onlyonepart", "a.", ".b", "a.b.c"])("rejects malformed token %s", (raw) => {
    expect(decode(raw as string | undefined)).toBeNull();
  });

  it("rejects a tampered payload and a tampered signature", () => {
    const raw = encode({ uid: "user-1", hid: "hh-1", iat: Math.floor(Date.now() / 1000) });
    const [payload, sig] = raw.split(".");
    const tweaked = Buffer.from(
      JSON.stringify({ uid: "user-evil", hid: "hh-1", iat: Math.floor(Date.now() / 1000) }),
    ).toString("base64url");
    expect(decode(`${tweaked}.${sig}`)).toBeNull();
    expect(decode(`${payload}.${sig.replace(/A/g, "B")}xxx`)).toBeNull();
  });

  it("rejects a session older than 8 hours", () => {
    const raw = encode({ uid: "user-1", hid: "hh-1", iat: Math.floor(Date.now() / 1000) - 8 * 60 * 60 - 5 });
    expect(decode(raw)).toBeNull();
  });

  it("accepts a session just inside the 8-hour window", () => {
    const raw = encode({ uid: "user-1", hid: "hh-1", iat: Math.floor(Date.now() / 1000) - 8 * 60 * 60 + 30 });
    expect(decode(raw)?.uid).toBe("user-1");
  });

  it("rejects a payload missing uid or iat", () => {
    const sign = (payload: object) => encode({ uid: "x", hid: null, iat: Math.floor(Date.now() / 1000) });
    const raw = sign({});
    const sig = raw.split(".")[1];
    const bad = Buffer.from(JSON.stringify({ hid: "hh-1", iat: "today" })).toString("base64url");
    expect(decode(`${bad}.${sig}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const raw = encode({ uid: "user-1", hid: "hh-1", iat: Math.floor(Date.now() / 1000) });
    process.env.SESSION_SECRET = "a-completely-other-secret";
    expect(decode(raw)).toBeNull();
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, lax, and path-scoped", () => {
    const opts = sessionCookieOptions(99);
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 99 });
    expect(opts.secure).toBe(process.env.NODE_ENV === "production");
  });
});

describe("invite codes", () => {
  it("issues a 10-character code from the unambiguous alphabet", () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const { code, hash } = newInviteCode();
    expect(code).toHaveLength(10);
    expect([...code].every((c) => alphabet.includes(c))).toBe(true);
    expect(hash).toBe(hashInviteCode(code));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes codes case-insensitively after trim", () => {
    expect(hashInviteCode("  abcd234567  ")).toBe(hashInviteCode("ABCD234567"));
  });

  it("does not include easily confused characters I, O, 0 or 1", () => {
    for (let i = 0; i < 20; i++) {
      expect(newInviteCode().code).not.toMatch(/[IO01]/);
    }
  });
});

describe("hashPassword", () => {
  it("stores a bcrypt hash that verifies the original password only", () => {
    const hash = hashPassword("s3cret-pass");
    expect(hash).not.toBe("s3cret-pass");
    expect(bcrypt.compareSync("s3cret-pass", hash)).toBe(true);
    expect(bcrypt.compareSync("wrong", hash)).toBe(false);
  });
});

describe("verifyLogin", () => {
  const email = "caretaker@example.com";
  const password = "house-key-9";
  const user = {
    id: "u1",
    name: "Ravi",
    email,
    password_hash: bcrypt.hashSync(password, 4),
    is_demo: 0,
    created_at: "2026-11-01T00:00:00+05:30",
  };

  beforeEach(() => {
    db.getAuthMeta.mockReset();
    db.setAuthMeta.mockReset();
    db.getUserByEmail.mockReset();
  });

  it("accepts the right password and clears the fail count", async () => {
    db.getAuthMeta.mockResolvedValue(undefined);
    db.getUserByEmail.mockResolvedValue(user);
    const result = await verifyLogin(email, password);
    expect(result).toEqual({ ok: true, user });
    expect(db.setAuthMeta).toHaveBeenCalledWith("login_fail:caretaker@example.com", "0");
  });

  it("is case-insensitive on the email and hides whether the user exists", async () => {
    db.getAuthMeta.mockResolvedValue(undefined);
    db.getUserByEmail.mockResolvedValue(undefined);
    const result = await verifyLogin("NEW@Example.COM", "nope");
    expect(result).toEqual({ ok: false, reason: "Wrong email or password", status: 401 });
    expect(db.getUserByEmail).toHaveBeenCalledWith("new@example.com");
  });

  it("locks the email after too many wrong passwords", async () => {
    db.getAuthMeta.mockImplementation(async (key: string) => {
      if (key.startsWith("login_lock:")) return undefined;
      if (key.startsWith("login_fail:")) return String(LOCKOUT_MAX_ATTEMPTS - 1);
      return undefined;
    });
    db.getUserByEmail.mockResolvedValue(user);
    const result = await verifyLogin(email, "wrong");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
    expect(db.setAuthMeta).toHaveBeenCalledWith("login_fail:caretaker@example.com", "0");
    const lockCall = db.setAuthMeta.mock.calls.find((c: string[]) => String(c[0]).startsWith("login_lock:"));
    expect(lockCall).toBeTruthy();
  });

  it("rejects attempts while the login lock is still active", async () => {
    db.getAuthMeta.mockResolvedValue(new Date(Date.now() + 60_000).toISOString());
    const result = await verifyLogin(email, password);
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(db.getUserByEmail).not.toHaveBeenCalled();
  });
});

describe("isLoginLocked", () => {
  it("is false when no lock or the lock has expired", async () => {
    db.getAuthMeta.mockResolvedValue(undefined);
    expect(await isLoginLocked("a@b.com")).toBe(false);
    db.getAuthMeta.mockResolvedValue(new Date(Date.now() - 1000).toISOString());
    expect(await isLoginLocked("a@b.com")).toBe(false);
  });
});

describe("constants used by sessions", () => {
  it("exports the session cookie name", () => {
    expect(SESSION_COOKIE).toBe("apnahaath_session");
  });
});
