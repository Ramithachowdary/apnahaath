import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "test-session-secret-32chars!!";

const requireMember = vi.fn();
const requireUser = vi.fn();
const generateDoctorBrief = vi.fn();
const generateWeeklySummary = vi.fn();
const getMembership = vi.fn();
const getUser = vi.fn();
const listUserHouseholds = vi.fn();
const getSession = vi.fn();
const exchangeGoogleCode = vi.fn();
const googleConfigured = vi.fn();
const getUserByEmail = vi.fn();
const getUserByGoogleId = vi.fn();
const setUserGoogle = vi.fn();
const createUser = vi.fn();
let googleState: string | undefined;

vi.mock("../src/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth")>();
  return { ...actual, requireMember, requireUser, getSession };
});
vi.mock("../src/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/gemini")>();
  return { ...actual, generateDoctorBrief };
});
vi.mock("../src/lib/weekly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/weekly")>();
  return { ...actual, generateWeeklySummary };
});
vi.mock("../src/lib/db", () => ({
  getMembership,
  getUser,
  listUserHouseholds,
  getUserByEmail,
  getUserByGoogleId,
  setUserGoogle,
  createUser,
  query: vi.fn(),
}));
vi.mock("../src/lib/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/google")>();
  return { ...actual, exchangeGoogleCode, googleConfigured };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (googleState ? { value: googleState } : undefined) }),
}));

const ctx = {
  user: { id: "u1", name: "Priya", email: "priya@example.com" },
  household: { id: "h1", elder_name: "Kamla Devi" },
  membership: { id: "m1", role: "family" },
  role: "family" as const,
};

beforeEach(() => {
  requireMember.mockReset();
  requireUser.mockReset();
  generateDoctorBrief.mockReset();
  generateWeeklySummary.mockReset();
  getMembership.mockReset();
  getUser.mockReset();
  listUserHouseholds.mockReset();
  getSession.mockReset();
  exchangeGoogleCode.mockReset();
  googleConfigured.mockReset();
  getUserByEmail.mockReset();
  getUserByGoogleId.mockReset();
  setUserGoogle.mockReset();
  createUser.mockReset();
  googleState = undefined;
  process.env.APP_URL = "https://apnahaath-care.vercel.app";
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const { POST } = await import("../src/app/api/auth/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie") || "").toMatch(/apnahaath_session=/);
  });
});

describe("GET /api/auth/me", () => {
  it("returns authenticated:false when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { GET } = await import("../src/app/api/auth/me/route");
    const res = await GET();
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it("returns the user and active household when signed in", async () => {
    getSession.mockResolvedValue({ uid: "u1", hid: "h1", iat: 1 });
    getUser.mockResolvedValue({ id: "u1", name: "Priya", email: "priya@example.com" });
    listUserHouseholds.mockResolvedValue([
      { id: "h1", elder_name: "Kamla Devi", city: "Lucknow", is_demo: 0, role: "family" },
    ]);
    const { GET } = await import("../src/app/api/auth/me/route");
    const body = await (await GET()).json();
    expect(body.authenticated).toBe(true);
    expect(body.user.email).toBe("priya@example.com");
    expect(body.activeHouseholdId).toBe("h1");
  });

  it("clears activeHouseholdId when the session points at a household the user left", async () => {
    getSession.mockResolvedValue({ uid: "u1", hid: "old", iat: 1 });
    getUser.mockResolvedValue({ id: "u1", name: "Priya", email: "priya@example.com" });
    listUserHouseholds.mockResolvedValue([]);
    const { GET } = await import("../src/app/api/auth/me/route");
    expect((await (await GET()).json()).activeHouseholdId).toBeNull();
  });
});

describe("POST /api/brief", () => {
  it("requires a signed-in member", async () => {
    requireMember.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Please sign in" }), { status: 401 }),
    });
    const { POST } = await import("../src/app/api/brief/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns the generated doctor brief", async () => {
    requireMember.mockResolvedValue({ ctx });
    generateDoctorBrief.mockResolvedValue("Doctor brief — Kamla Devi");
    const { POST } = await import("../src/app/api/brief/route");
    const res = await POST();
    expect(await res.json()).toEqual({ brief: "Doctor brief — Kamla Devi" });
    expect(generateDoctorBrief).toHaveBeenCalledWith("h1", "Kamla Devi");
  });
});

describe("POST /api/summary/weekly", () => {
  it("requires a signed-in member", async () => {
    requireMember.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Please sign in" }), { status: 401 }),
    });
    const { POST } = await import("../src/app/api/summary/weekly/route");
    expect((await POST()).status).toBe(401);
  });

  it("returns stats and the summary for a member", async () => {
    requireMember.mockResolvedValue({ ctx });
    generateWeeklySummary.mockResolvedValue({
      stats: { confirmed: 1 },
      summary: { elder: "Thanks", caretaker: "Remind her kindly today.", family: "A quiet week with no dose changes." },
      source: "template",
      disclaimer: "d",
    });
    const { POST } = await import("../src/app/api/summary/weekly/route");
    const body = await (await POST()).json();
    expect(body.source).toBe("template");
    expect(body.stats).toEqual({ confirmed: 1 });
  });
});

describe("POST /api/households/select", () => {
  const post = async (body: unknown) => {
    const { POST } = await import("../src/app/api/households/select/route");
    return POST(
      new Request("http://localhost/api/households/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  };

  it("requires sign-in", async () => {
    requireUser.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Please sign in" }), { status: 401 }),
    });
    expect((await post({ householdId: "h1" })).status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    requireUser.mockResolvedValue({ user: ctx.user, session: { uid: "u1", hid: null, iat: 1 } });
    expect((await post({ householdId: "x".repeat(81) })).status).toBe(400);
  });

  it("rejects a household the user does not belong to", async () => {
    requireUser.mockResolvedValue({ user: ctx.user, session: { uid: "u1", hid: null, iat: 1 } });
    getMembership.mockResolvedValue(undefined);
    const res = await post({ householdId: "h-other" });
    expect(res.status).toBe(403);
  });

  it("switches the active household", async () => {
    requireUser.mockResolvedValue({ user: ctx.user, session: { uid: "u1", hid: null, iat: 1 } });
    getMembership.mockResolvedValue({ id: "m1" });
    const res = await post({ householdId: "h1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie") || "").toMatch(/apnahaath_session=/);
  });
});

describe("GET /api/auth/google/callback", () => {
  const get = async (qs: string) => {
    const { GET } = await import("../src/app/api/auth/google/callback/route");
    return GET(new Request(`https://apnahaath-care.vercel.app/api/auth/google/callback?${qs}`));
  };

  it("fails when Google is not configured", async () => {
    googleConfigured.mockReturnValue(false);
    const res = await get("code=x&state=y");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/auth_error=google_unavailable/);
  });

  it("fails when the state cookie does not match", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "expected-state-value-ok";
    const res = await get("code=x&state=different-state-val");
    expect(res.headers.get("location")).toMatch(/auth_error=google_state/);
  });

  it("fails when Google returns an unverified email", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "state-value-1234567890";
    exchangeGoogleCode.mockResolvedValue({ sub: "g1", email: "a@example.com", email_verified: false, name: "A" });
    const res = await get("code=ok&state=state-value-1234567890");
    expect(res.headers.get("location")).toMatch(/auth_error=google_unverified/);
  });

  it("fails when the token exchange throws", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "state-value-1234567890";
    exchangeGoogleCode.mockRejectedValue(new Error("nope"));
    const res = await get("code=ok&state=state-value-1234567890");
    expect(res.headers.get("location")).toMatch(/auth_error=google_failed/);
  });

  it("signs in an existing Google user", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "state-value-1234567890";
    exchangeGoogleCode.mockResolvedValue({ sub: "g1", email: "a@example.com", email_verified: true, name: "A" });
    getUserByGoogleId.mockResolvedValue({ id: "u1", name: "A", email: "a@example.com" });
    listUserHouseholds.mockResolvedValue([{ id: "h1" }]);
    const res = await get("code=ok&state=state-value-1234567890");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://apnahaath-care.vercel.app/");
    expect(res.headers.get("set-cookie") || "").toMatch(/apnahaath_session=/);
  });

  it("links a verified email to an existing account", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "state-value-1234567890";
    exchangeGoogleCode.mockResolvedValue({
      sub: "g-new",
      email: "priya@example.com",
      email_verified: true,
      name: "Priya",
    });
    getUserByGoogleId.mockResolvedValue(undefined);
    getUserByEmail.mockResolvedValue({ id: "u1", email: "priya@example.com" });
    listUserHouseholds.mockResolvedValue([]);
    const res = await get("code=ok&state=state-value-1234567890");
    expect(setUserGoogle).toHaveBeenCalledWith("u1", "g-new");
    expect(res.status).toBe(307);
  });

  it("creates a user when the Google account is new", async () => {
    googleConfigured.mockReturnValue(true);
    googleState = "state-value-1234567890";
    exchangeGoogleCode.mockResolvedValue({
      sub: "g-new",
      email: "new@example.com",
      email_verified: true,
      name: "New User",
    });
    getUserByGoogleId.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "u-new", email: "new@example.com" });
    getUserByEmail.mockResolvedValue(undefined);
    listUserHouseholds.mockResolvedValue([]);
    const res = await get("code=ok&state=state-value-1234567890");
    expect(createUser).toHaveBeenCalled();
    expect(res.status).toBe(307);
  });
});
