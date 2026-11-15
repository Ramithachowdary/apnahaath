import { beforeAll, describe, expect, it, vi } from "vitest";

// Simulated browser cookie jar: next/headers cookies() reads the "current" agent's cookie.
let currentCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (currentCookie ? { value: currentCookie } : undefined) }),
}));

delete process.env.DATABASE_URL; // PGlite in-memory Postgres
process.env.SESSION_SECRET = "test-session-secret-32chars!!";
process.env.RESET_ADMIN_CODE = "424242";
delete process.env.GEMINI_API_KEY;
delete process.env.ADAPTION_API_KEY;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;

class Agent {
  cookie: string | undefined;
  async call(handler: (req: Request) => Promise<Response>, body?: unknown, method = "POST") {
    currentCookie = this.cookie;
    const req = new Request("http://localhost/api/x", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await handler(req);
    const set = res.headers.get("set-cookie");
    const m = set && /apnahaath_session=([^;]*)/.exec(set);
    if (m) this.cookie = m[1] || undefined;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  }
  async get(handler: () => Promise<Response>) {
    currentCookie = this.cookie;
    const res = await handler();
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  }
}

const r = {
  signup: () => import("../src/app/api/auth/signup/route"),
  login: () => import("../src/app/api/auth/login/route"),
  households: () => import("../src/app/api/households/route"),
  invites: () => import("../src/app/api/invites/route"),
  join: () => import("../src/app/api/invites/join/route"),
  state: () => import("../src/app/api/state/route"),
  confirm: () => import("../src/app/api/doses/confirm/route"),
  skip: () => import("../src/app/api/doses/skip/route"),
  witness: () => import("../src/app/api/doses/witness/route"),
  proposals: () => import("../src/app/api/proposals/route"),
  appointments: () => import("../src/app/api/appointments/route"),
  demo: () => import("../src/app/api/demo/start/route"),
  sw: () => import("../src/app/api/demo/switch/route"),
  reset: () => import("../src/app/api/demo/reset/route"),
  messages: () => import("../src/app/api/cards/messages/route"),
};

// A real (non-demo) care circle built through the public flow
const priya = new Agent();
const kamla = new Agent();
const sunita = new Agent();
let householdId = "";

beforeAll(async () => {
  const s = await r.signup();
  expect((await priya.call(s.POST, { name: "Priya", email: "priya@example.com", password: "password123" })).status).toBe(200);
  const h = await (await r.households()).POST;
  const created = await priya.call(h, { elder_name: "Kamla Devi", elder_age: 74, city: "Lucknow", language: "English", role: "family", pin: "3333" });
  expect(created.status).toBe(200);
  householdId = created.json.householdId as string;
  const inv = await r.invites();
  const elderInv = await priya.call(inv.POST, { role: "elder" });
  const careInv = await priya.call(inv.POST, { role: "caretaker" });
  expect(elderInv.status).toBe(200);
  await kamla.call(s.POST, { name: "Kamla Devi", email: "kamla@example.com", password: "password123" });
  await sunita.call(s.POST, { name: "Sunita", email: "sunita@example.com", password: "password123" });
  const j = await r.join();
  expect((await kamla.call(j.POST, { code: elderInv.json.code, pin: "1111" })).json.role).toBe("elder");
  expect((await sunita.call(j.POST, { code: careInv.json.code, pin: "2222" })).json.role).toBe("caretaker");
  // invite codes are single-use
  const again = await new Agent().call(s.POST, { name: "X", email: "x@example.com", password: "password123" });
  expect(again.status).toBe(200);
  // Priya proposes a medicine; Kamla accepts -> today's dose exists
  const pr = await r.proposals();
  const prop = await priya.call(pr.POST, { pin: "3333", kind: "add", payload: { name: "Telma 40", dose: "40 mg", schedule_time: "23:30" } });
  expect(prop.status).toBe(200);
  expect((await kamla.call(pr.PATCH, { pin: "1111", proposalId: prop.json.proposalId, decision: "accept" }, "PATCH")).status).toBe(200);
});

async function todaySlotId(agent: Agent) {
  const st = await agent.get((await r.state()).GET);
  return st.json.doseSlots[0].id as string;
}

describe("accounts, care circles, invites", () => {
  it("login works with the right password and rejects a wrong one", async () => {
    const l = await r.login();
    expect((await new Agent().call(l.POST, { email: "priya@example.com", password: "wrong-pass" })).status).toBe(401);
    expect((await new Agent().call(l.POST, { email: "priya@example.com", password: "password123" })).status).toBe(200);
  });

  it("an invite code cannot be reused", async () => {
    const inv = await priya.call((await r.invites()).POST, { role: "family" });
    const a = new Agent();
    const b = new Agent();
    await a.call((await r.signup()).POST, { name: "A", email: "a1@example.com", password: "password123" });
    await b.call((await r.signup()).POST, { name: "B", email: "b1@example.com", password: "password123" });
    expect((await a.call((await r.join()).POST, { code: inv.json.code, pin: "4444" })).status).toBe(200);
    expect((await b.call((await r.join()).POST, { code: inv.json.code, pin: "4444" })).status).toBe(400);
  });

  it("only the owner can create invites", async () => {
    expect((await kamla.call((await r.invites()).POST, { role: "family" })).status).toBe(403);
  });

  it("login is locked after 5 wrong passwords", async () => {
    const l = await r.login();
    for (let i = 0; i < 5; i++) await new Agent().call(l.POST, { email: "sunita@example.com", password: "nope-nope" });
    expect((await new Agent().call(l.POST, { email: "sunita@example.com", password: "password123" })).status).toBe(429);
  });
});

describe("role rules", () => {
  it("caretaker cannot confirm a dose (403); witness does not mark it taken", async () => {
    const id = await todaySlotId(sunita);
    expect((await sunita.call((await r.confirm()).POST, { doseSlotId: id, pin: "2222" })).status).toBe(403);
    expect((await sunita.call((await r.witness()).POST, { doseSlotId: id, pin: "2222" })).status).toBe(200);
    const st = await sunita.get((await r.state()).GET);
    expect(st.json.doseSlots[0].status).toBe("pending");
    expect(st.json.adherence.witnessed).toBe(1);
    expect(st.json.adherence.elderConfirmed).toBe(0);
  });

  it("family cannot mark a dose taken (403)", async () => {
    const id = await todaySlotId(priya);
    expect((await priya.call((await r.confirm()).POST, { doseSlotId: id, pin: "3333" })).status).toBe(403);
  });

  it("elder PIN locks after 5 wrong tries", async () => {
    const id = await todaySlotId(kamla);
    const c = await r.confirm();
    for (let i = 0; i < 5; i++) expect((await kamla.call(c.POST, { doseSlotId: id, pin: "9999" })).status).toBe(401);
    const locked = await kamla.call(c.POST, { doseSlotId: id, pin: "1111" });
    expect(locked.status).toBe(401);
    expect(String(locked.json.error)).toMatch(/Locked/);
  });

  it("family can add and edit an appointment; caretaker cannot", async () => {
    const ap = await r.appointments();
    const add = await priya.call(ap.POST, { pin: "3333", doctor: "Dr. Sharma", place: "Aliganj", scheduled_at: "2026-11-19T11:15" });
    expect(add.status).toBe(200);
    expect((await priya.call(ap.POST, { pin: "3333", id: add.json.id, doctor: "Dr. Sharma", place: "Room 4", scheduled_at: "2026-11-19T11:30" })).status).toBe(200);
    expect((await sunita.call(ap.POST, { pin: "2222", doctor: "x", place: "y", scheduled_at: "2026-11-19T11:30" })).status).toBe(403);
  });
});

describe("isolation and security", () => {
  it("a member of another household cannot read or act on this one", async () => {
    const outsider = new Agent();
    await outsider.call((await r.demo()).POST); // signed into their own demo household
    const id = await todaySlotId(kamla);
    // outsider (demo family) cannot touch Kamla's real slot: id not found in *their* household
    await outsider.call((await r.sw()).POST, { role: "elder" });
    const res = await outsider.call((await r.confirm()).POST, { doseSlotId: id, pin: "1111" });
    expect(res.status).toBe(404);
    // and cannot switch into the real household
    const sel = await import("../src/app/api/households/select/route");
    expect((await outsider.call(sel.POST, { householdId })).status).toBe(403);
    // state only ever shows their own household
    const st = await outsider.get((await r.state()).GET);
    expect(st.json.household.id).not.toBe(householdId);
  });

  it("forged / unsigned session cookie is rejected", async () => {
    const forged = new Agent();
    forged.cookie = Buffer.from(JSON.stringify({ uid: "u-x", hid: householdId, iat: Date.now() / 1000 })).toString("base64url") + ".fake";
    expect((await forged.get((await r.state()).GET)).status).toBe(401);
  });

  it("reset without the admin code is rejected", async () => {
    const rs = await r.reset();
    expect((await new Agent().call(rs.POST, {})).status).toBe(400);
    expect((await new Agent().call(rs.POST, { passcode: "111111" })).status).toBe(401);
  });
});

describe("demo household", () => {
  it("creates an isolated seeded household with the Brufen card and three demo logins", async () => {
    const judge = new Agent();
    const d = await judge.call((await r.demo()).POST);
    expect(d.status).toBe(200);
    expect((d.json.credentials as unknown[]).length).toBe(3);
    const st = await judge.get((await r.state()).GET);
    expect(st.json.cards.some((c: { title: string }) => /Brufen/.test(c.title))).toBe(true);
    expect(st.json.me.role).toBe("family");
    expect(st.json.history.length).toBeGreaterThan(5);
  });

  it("skip is not counted as missed and never triggers a missed email; reminder runs are idempotent", async () => {
    const judge = new Agent();
    await judge.call((await r.demo()).POST);
    await judge.call((await r.sw()).POST, { role: "elder" });
    const st = await judge.get((await r.state()).GET);
    const pending = [...st.json.doseSlots].reverse().find((s: { status: string }) => s.status === "pending");
    const before = st.json.adherence;
    expect((await judge.call((await r.skip()).POST, { doseSlotId: pending.id, pin: "1111", reason: "Fasting" })).status).toBe(200);
    const after = (await judge.get((await r.state()).GET)).json.adherence;
    expect(after.skipped).toBe(before.skipped + 1);
    expect(after.missed).toBe(before.missed);
    // push all remaining pending slots far into the past, then run reminders twice
    const { query } = await import("../src/lib/db");
    await query(`UPDATE dose_slots SET scheduled_at = ? WHERE household_id = ? AND status='pending'`, [new Date(Date.now() - 5 * 3600_000).toISOString(), st.json.household.id]);
    const { runMorningCheck } = await import("../src/lib/reminders");
    await runMorningCheck(st.json.household.id);
    const { listOutbox } = await import("../src/lib/db");
    const n1 = (await listOutbox(st.json.household.id)).length;
    await runMorningCheck(st.json.household.id);
    const out = await listOutbox(st.json.household.id);
    expect(out.length).toBe(n1);
    expect(out.some((o) => o.kind === "missed" && o.idempotency_key.includes(pending.id))).toBe(false);
    for (const o of out) expect(o.subject).not.toMatch(/telma|glycomet|brufen|ecosprin|shelcal|thyronorm/i);
  });
});

describe("AI guards", () => {
  it("Gemini card JSON with a dose change is rejected", async () => {
    const { validateWarnOnlyCard } = await import("../src/lib/gemini");
    const base = {
      severity: "review_required", title: "Brufen + Ecosprin",
      elder_line_hi: "Please talk to your doctor. Nothing was changed.",
      caretaker_line_hi: "Please tell the doctor about the Brufen.",
      family_line_en: "Possible interaction; clinician review recommended.",
      tell_doctor: "Mention self-added Brufen.", changes_prescription: false, dose_change: null,
    };
    expect(validateWarnOnlyCard(base).ok).toBe(true);
    expect(validateWarnOnlyCard({ ...base, dose_change: { drug: "Ecosprin", to: "0 mg" } }).ok).toBe(false);
    expect(validateWarnOnlyCard({ ...base, changes_prescription: true }).ok).toBe(false);
    expect(validateWarnOnlyCard({ ...base, family_line_en: "Stop taking Ecosprin today." }).ok).toBe(false);
  });

  it("Adaption output with a dose change is rejected and falls back to templates", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify({ elder: "Kamla ji, please stop taking Ecosprin now.", caretaker: "Give half the dose of Ecosprin.", family: "We reduced the dose of Ecosprin to 40mg today." }) }), { status: 200 }),
    );
    const { generateCareMessages } = await import("../src/lib/adaption");
    const card = {
      id: "c", household_id: "h", source_event_id: null, severity: "review_required", title: "Brufen + Ecosprin",
      elder_line_hi: "Please talk to your doctor.", caretaker_line_hi: "Do not give Brufen until the doctor says so.",
      family_line_en: "Possible interaction.", tell_doctor: "Mention Brufen.", disclaimer: "", emergency_line: "", cached: 1, created_at: "",
    };
    const res = await generateCareMessages(card, "Kamla Devi");
    expect(res.source).toBe("template");
    expect(res.messages.caretaker).toBe(card.caretaker_line_hi);
    fetchMock.mockRestore();
    delete process.env.ADAPTION_API_KEY;
  });

  it("Thyronorm–Shelcal 4-hour gap is enforced in code", async () => {
    const { query } = await import("../src/lib/db");
    await query("UPDATE memberships SET lockout_until = NULL, failed_attempts = 0");
    const pr = await r.proposals();
    const add = await priya.call(pr.POST, { pin: "3333", kind: "add", payload: { name: "Thyronorm 50", schedule_time: "06:30" } });
    await kamla.call(pr.PATCH, { pin: "1111", proposalId: add.json.proposalId, decision: "accept" }, "PATCH");
    const st = await priya.get((await r.state()).GET);
    expect(st.json.medicines.some((m: { name: string }) => m.name === "Thyronorm 50")).toBe(true);
    const bad = await priya.call(pr.POST, { pin: "3333", kind: "add", payload: { name: "Shelcal 500", schedule_time: "08:00" } });
    expect(bad.status).toBe(400);
    const ok = await priya.call(pr.POST, { pin: "3333", kind: "add", payload: { name: "Shelcal 500", schedule_time: "16:00" } });
    expect(ok.status).toBe(200);
  });
});

describe("weekly care summary (Adaption)", () => {
  it("computes numbers in code, rejects a dose-change summary and falls back to the template", async () => {
    const { generateWeeklySummary, computeWeekStats } = await import("../src/lib/weekly");
    const st = await computeWeekStats(householdId);
    expect(st.confirmed).toBeGreaterThanOrEqual(0);
    const prevKey = process.env.ADAPTION_API_KEY;
    process.env.ADAPTION_API_KEY = "test-key";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ output_text: JSON.stringify({ elder: "Take two tablets of Telma now.", caretaker: "Increase the dose to 80 mg.", family: "We doubled the dose of Telma this week to fix her BP." }) }), { status: 200 })) as typeof fetch;
    try {
      const r = await generateWeeklySummary(householdId, "Kamla Devi");
      expect(r.source).toBe("template");
      expect(r.summary.family).toContain("Elder-confirmation rate");
      expect(r.disclaimer.length).toBeGreaterThan(10);
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ output_text: JSON.stringify({ elder: "Kamla ji, you did well this week. Thank you.", caretaker: "Remind her at night and let her mark it herself.", family: "This week Kamla confirmed most doses herself.\nNothing was missed.\nAsk the doctor about evening timing." }) }), { status: 200 })) as typeof fetch;
      const ok = await generateWeeklySummary(householdId, "Kamla Devi");
      expect(ok.source).toBe("adaption");
    } finally {
      globalThis.fetch = realFetch;
      process.env.ADAPTION_API_KEY = prevKey;
    }
  });

  it("weekly summary route requires sign-in", async () => {
    const mod = await import("../src/app/api/summary/weekly/route");
    expect((await new Agent().call(mod.POST as never, {})).status).toBe(401);
  });
});
