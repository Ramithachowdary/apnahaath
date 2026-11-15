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
  messages: () => import("../src/app/api/cards/messages/route"),
};

/** Sign-up is two steps: create (emails a code) + verify (signs in). Tests get the code back outside production. */
async function signUp(agent: Agent, body: { name: string; email: string; password: string }) {
  const res = await agent.call((await r.signup()).POST, body);
  if (res.status !== 200) return res;
  const v = await import("../src/app/api/auth/verify/route");
  return agent.call(v.POST, { email: body.email, code: res.json.devCode });
}

// A real care circle built through the public flow
const priya = new Agent();
const kamla = new Agent();
const sunita = new Agent();
let householdId = "";

beforeAll(async () => {
  const s = await r.signup();
  expect((await signUp(priya, { name: "Priya", email: "priya@example.com", password: "password123" })).status).toBe(
    200,
  );
  const h = await (await r.households()).POST;
  const created = await priya.call(h, {
    elder_name: "Kamla Devi",
    elder_age: 74,
    city: "Lucknow",
    language: "English",
    role: "family",
    pin: "3333",
  });
  expect(created.status).toBe(200);
  householdId = created.json.householdId as string;
  const inv = await r.invites();
  const elderInv = await priya.call(inv.POST, { role: "elder" });
  const careInv = await priya.call(inv.POST, { role: "caretaker" });
  expect(elderInv.status).toBe(200);
  await signUp(kamla, { name: "Kamla Devi", email: "kamla@example.com", password: "password123" });
  await signUp(sunita, { name: "Sunita", email: "sunita@example.com", password: "password123" });
  const j = await r.join();
  expect((await kamla.call(j.POST, { code: elderInv.json.code, pin: "1111" })).json.role).toBe("elder");
  expect((await sunita.call(j.POST, { code: careInv.json.code, pin: "2222" })).json.role).toBe("caretaker");
  // invite codes are single-use
  const again = await signUp(new Agent(), { name: "X", email: "x@example.com", password: "password123" });
  expect(again.status).toBe(200);
  // Priya proposes a medicine; Kamla accepts -> today's dose exists
  const pr = await r.proposals();
  const prop = await priya.call(pr.POST, {
    pin: "3333",
    kind: "add",
    payload: { name: "Telma 40", dose: "40 mg", schedule_time: "23:30" },
  });
  expect(prop.status).toBe(200);
  expect(
    (await kamla.call(pr.PATCH, { pin: "1111", proposalId: prop.json.proposalId, decision: "accept" }, "PATCH")).status,
  ).toBe(200);
});

async function todaySlotId(agent: Agent) {
  const st = await agent.get((await r.state()).GET);
  return st.json.doseSlots[0].id as string;
}

describe("12-hour clock display", () => {
  it("formats HH:MM and IST ISO times with AM/PM", async () => {
    const { formatTime12 } = await import("../src/lib/time");
    expect(formatTime12("08:00")).toBe("8:00 AM");
    expect(formatTime12("00:00")).toBe("12:00 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("13:30")).toBe("1:30 PM");
    expect(formatTime12("2026-11-15T16:00:00+05:30")).toBe("4:00 PM");
  });
});

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
    await signUp(a, { name: "A", email: "a1@example.com", password: "password123" });
    await signUp(b, { name: "B", email: "b1@example.com", password: "password123" });
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

  it("confirming a dose twice is rejected and writes only one event", async () => {
    const elder = new Agent();
    await signUp(elder, { name: "Meera", email: "meera-qa@example.com", password: "password123" });
    expect(
      (
        await elder.call((await r.households()).POST, {
          elder_name: "Meera",
          elder_age: 70,
          city: "Pune",
          language: "English",
          role: "elder",
          pin: "1111",
        })
      ).status,
    ).toBe(200);
    const pr = await r.proposals();
    const prop = await elder.call(pr.POST, {
      pin: "1111",
      kind: "add",
      payload: { name: "Telma 40", dose: "40 mg", schedule_time: "21:00" },
    });
    expect(prop.status).toBe(200);
    const id = (await elder.get((await r.state()).GET)).json.doseSlots[0].id as string;
    const c = await r.confirm();
    expect((await elder.call(c.POST, { doseSlotId: id, pin: "1111" })).status).toBe(200);
    const again = await elder.call(c.POST, { doseSlotId: id, pin: "1111" });
    expect(again.status).toBe(409);
    expect(String(again.json.error)).toMatch(/Already taken/);
    const ev = (await elder.get((await r.state()).GET)).json.events.filter(
      (e: { type: string }) => e.type === "elder_confirmed",
    );
    expect(ev).toHaveLength(1);
  });

  it("family can add and edit an appointment; caretaker cannot", async () => {
    const ap = await r.appointments();
    const add = await priya.call(ap.POST, {
      pin: "3333",
      doctor: "Dr. Sharma",
      place: "Aliganj",
      scheduled_at: "2026-11-19T11:15",
    });
    expect(add.status).toBe(200);
    expect(
      (
        await priya.call(ap.POST, {
          pin: "3333",
          id: add.json.id,
          doctor: "Dr. Sharma",
          place: "Room 4",
          scheduled_at: "2026-11-19T11:30",
        })
      ).status,
    ).toBe(200);
    expect(
      (await sunita.call(ap.POST, { pin: "2222", doctor: "x", place: "y", scheduled_at: "2026-11-19T11:30" })).status,
    ).toBe(403);
  });
});

describe("isolation and security", () => {
  it("a member of another household cannot read or act on this one", async () => {
    // outsider is the elder of their own, separate care circle
    const outsider = new Agent();
    await signUp(outsider, { name: "Outsider", email: "outsider@example.com", password: "password123" });
    await outsider.call((await r.households()).POST, {
      elder_name: "Other Elder",
      elder_age: 80,
      city: "Pune",
      language: "English",
      role: "elder",
      pin: "1111",
    });
    const id = await todaySlotId(kamla);
    // outsider cannot touch Kamla's slot: id not found in *their* household
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
    forged.cookie =
      Buffer.from(JSON.stringify({ uid: "u-x", hid: householdId, iat: Date.now() / 1000 })).toString("base64url") +
      ".fake";
    expect((await forged.get((await r.state()).GET)).status).toBe(401);
  });
});

describe("reminders and skips", () => {
  it("skip is not counted as missed and never triggers a missed email; reminder runs are idempotent", async () => {
    // a fresh real circle where the creator is the elder
    const elder = new Agent();
    await signUp(elder, { name: "Savitri", email: "savitri@example.com", password: "password123" });
    const hh = (
      await elder.call((await r.households()).POST, {
        elder_name: "Savitri",
        elder_age: 78,
        city: "Jaipur",
        language: "English",
        role: "elder",
        pin: "1111",
      })
    ).json.householdId as string;
    const pr = await r.proposals();
    for (const [name, t] of [
      ["Telma 40", "23:40"],
      ["Glycomet 500", "23:50"],
    ]) {
      const p = await elder.call(pr.POST, {
        pin: "1111",
        kind: "add",
        payload: { name, dose: "1 tablet", schedule_time: t },
      });
      expect(p.status).toBe(200);
      if (p.json.proposalId)
        await elder.call(pr.PATCH, { pin: "1111", proposalId: p.json.proposalId, decision: "accept" }, "PATCH");
    }
    const st = await elder.get((await r.state()).GET);
    expect(st.json.doseSlots.length).toBe(2);
    const pending = st.json.doseSlots.find((s: { status: string }) => s.status === "pending");
    const before = st.json.adherence;
    expect(
      (await elder.call((await r.skip()).POST, { doseSlotId: pending.id, pin: "1111", reason: "Fasting" })).status,
    ).toBe(200);
    const after = (await elder.get((await r.state()).GET)).json.adherence;
    expect(after.skipped).toBe(before.skipped + 1);
    expect(after.missed).toBe(before.missed);
    // push the remaining pending slot far into the past, then run reminders twice
    const { query, listOutbox } = await import("../src/lib/db");
    await query(`UPDATE dose_slots SET scheduled_at = ? WHERE household_id = ? AND status='pending'`, [
      new Date(Date.now() - 5 * 3600_000).toISOString(),
      hh,
    ]);
    const { runMorningCheck } = await import("../src/lib/reminders");
    await runMorningCheck(hh);
    const n1 = (await listOutbox(hh)).length;
    await runMorningCheck(hh);
    const out = await listOutbox(hh);
    expect(out.length).toBe(n1);
    expect(out.some((o) => o.kind === "missed" && o.idempotency_key.includes(pending.id))).toBe(false);
    for (const o of out) expect(o.subject).not.toMatch(/telma|glycomet|brufen|ecosprin|shelcal|thyronorm/i);
  });
});

describe("AI guards", () => {
  it("Gemini card JSON with a dose change is rejected", async () => {
    const { validateWarnOnlyCard } = await import("../src/lib/gemini");
    const base = {
      severity: "review_required",
      title: "Brufen + Ecosprin",
      elder_line_hi: "Please talk to your doctor. Nothing was changed.",
      caretaker_line_hi: "Please tell the doctor about the Brufen.",
      family_line_en: "Possible interaction; clinician review recommended.",
      tell_doctor: "Mention self-added Brufen.",
      changes_prescription: false,
      dose_change: null,
    };
    expect(validateWarnOnlyCard(base).ok).toBe(true);
    expect(validateWarnOnlyCard({ ...base, dose_change: { drug: "Ecosprin", to: "0 mg" } }).ok).toBe(false);
    expect(validateWarnOnlyCard({ ...base, changes_prescription: true }).ok).toBe(false);
    expect(validateWarnOnlyCard({ ...base, family_line_en: "Stop taking Ecosprin today." }).ok).toBe(false);
  });

  it("Adaption output with a dose change is rejected and falls back to templates", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            elder: "Kamla ji, please stop taking Ecosprin now.",
            caretaker: "Give half the dose of Ecosprin.",
            family: "We reduced the dose of Ecosprin to 40mg today.",
          }),
        }),
        { status: 200 },
      ),
    );
    const { generateCareMessages } = await import("../src/lib/adaption");
    const card = {
      id: "c",
      household_id: "h",
      source_event_id: null,
      severity: "review_required",
      title: "Brufen + Ecosprin",
      elder_line_hi: "Please talk to your doctor.",
      caretaker_line_hi: "Do not give Brufen until the doctor says so.",
      family_line_en: "Possible interaction.",
      tell_doctor: "Mention Brufen.",
      disclaimer: "",
      emergency_line: "",
      cached: 1,
      created_at: "",
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
    const add = await priya.call(pr.POST, {
      pin: "3333",
      kind: "add",
      payload: { name: "Thyronorm 50", schedule_time: "06:30" },
    });
    await kamla.call(pr.PATCH, { pin: "1111", proposalId: add.json.proposalId, decision: "accept" }, "PATCH");
    const st = await priya.get((await r.state()).GET);
    expect(st.json.medicines.some((m: { name: string }) => m.name === "Thyronorm 50")).toBe(true);
    const bad = await priya.call(pr.POST, {
      pin: "3333",
      kind: "add",
      payload: { name: "Shelcal 500", schedule_time: "08:00" },
    });
    expect(bad.status).toBe(400);
    const ok = await priya.call(pr.POST, {
      pin: "3333",
      kind: "add",
      payload: { name: "Shelcal 500", schedule_time: "16:00" },
    });
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
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            elder: "Take two tablets of Telma now.",
            caretaker: "Increase the dose to 80 mg.",
            family: "We doubled the dose of Telma this week to fix her BP.",
          }),
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const r = await generateWeeklySummary(householdId, "Kamla Devi");
      expect(r.source).toBe("template");
      expect(r.summary.family).toContain("Elder-confirmation rate");
      expect(r.disclaimer.length).toBeGreaterThan(10);
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              elder: "Kamla ji, you did well this week. Thank you.",
              caretaker: "Remind her at night and let her mark it herself.",
              family:
                "This week Kamla confirmed most doses herself.\nNothing was missed.\nAsk the doctor about evening timing.",
            }),
          }),
          { status: 200 },
        )) as typeof fetch;
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

describe("no-dose-change guard (rejectsMutation)", () => {
  it("rejects instructions that would change, stop or replace a medicine", async () => {
    const { rejectsMutation } = await import("../src/lib/gemini");
    const bad = [
      "Discontinue Ecosprin for now.",
      "Please stop taking Telma.",
      "Hold this medicine until Monday.",
      "Do not take her Glycomet tonight.",
      "Skip your dose of Shelcal today.",
      "Reduce Telma to half a tablet.",
      "Halve the dose of Glycomet.",
      "Double the dose tomorrow.",
      "Increase the dose to 80 mg.",
      "Take two tablets of Brufen now.",
      "Switch to paracetamol instead.",
      "Withhold the tablet if sugar is low.",
      "Taper the dose over a week.",
    ];
    for (const t of bad) expect(rejectsMutation(t), t).toBe(true);
  });
  it("allows ordinary warn-only safety advice", async () => {
    const { rejectsMutation } = await import("../src/lib/gemini");
    const ok = [
      "Brufen with Ecosprin can increase the risk of stomach bleeding; she took 400 mg today.",
      "Do not double the dose to make up for a missed one.",
      "Do not stop or change any medicine without asking the doctor.",
      "Tell Dr. Sharma about the knee pain and the Brufen.",
      "Kamla has lower back pain and took Brufen 400 mg.",
    ];
    for (const t of ok) expect(rejectsMutation(t), t).toBe(false);
  });
});

describe("rate limits", () => {
  it("per-IP sign-up limiter blocks one client but not another", async () => {
    const { rateLimit, resetRateLimits } = await import("../src/lib/ratelimit");
    resetRateLimits();
    for (let i = 0; i < 8; i++) expect(rateLimit("signup:1.1.1.1", 8, 60_000)).toBe(true);
    expect(rateLimit("signup:1.1.1.1", 8, 60_000)).toBe(false);
    expect(rateLimit("signup:2.2.2.2", 8, 60_000)).toBe(true);
    expect(rateLimit("signup:1.1.1.1", 8, 60_000, Date.now() + 61_000)).toBe(true);
    resetRateLimits();
  });
});

describe("safety-note dedupe", () => {
  it("keeps only the newest note about the same medicines", async () => {
    const { dedupeCards } = await import("../src/lib/cards");
    const base = {
      household_id: "h",
      source_event_id: null,
      severity: "review_required",
      elder_line_hi: "x",
      caretaker_line_hi: "x",
      tell_doctor: "x",
      disclaimer: "x",
      emergency_line: "x",
      cached: 0,
    };
    const cards = [
      {
        ...base,
        id: "a",
        title: "Brufen and Ecosprin",
        family_line_en: "Brufen with Ecosprin raises bleeding risk",
        created_at: "2026-11-15T09:00:00+05:30",
      },
      {
        ...base,
        id: "b",
        title: "Brufen interaction notice",
        family_line_en: "Brufen and Ecosprin together",
        created_at: "2026-11-15T11:00:00+05:30",
      },
      {
        ...base,
        id: "c",
        title: "Thyronorm timing",
        family_line_en: "Keep Thyronorm 4 hours from Shelcal",
        created_at: "2026-11-15T10:00:00+05:30",
      },
    ];
    const out = dedupeCards(cards as never, ["Brufen 400", "Ecosprin 75", "Thyronorm 50", "Shelcal 500"]);
    expect(out.map((c) => c.id)).toEqual(["b", "c"]);
  });
});

describe("one-tap email links (signed, expiring, single use)", () => {
  async function ids() {
    const { listMembers } = await import("../src/lib/db");
    const members = await listMembers(householdId);
    const uid = (role: string) => members.find((m) => m.role === role)!.id;
    return { elder: uid("elder"), family: uid("family"), slot: await todaySlotId(kamla) };
  }

  it("rejects tampered, expired and other-household links", async () => {
    const { createDoseToken, redeemDoseToken } = await import("../src/lib/doselink");
    const { elder, slot } = await ids();
    const t = createDoseToken({ hid: householdId, sid: slot, uid: elder, role: "elder" });
    const [p, s] = t.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "elder", uid: "someone" }),
    ).toString("base64url");
    expect((await redeemDoseToken(`${forged}.${s}`)).ok).toBe(false);
    const expired = createDoseToken(
      { hid: householdId, sid: slot, uid: elder, role: "elder" },
      60,
      Date.now() / 1000 - 3600,
    );
    expect(await redeemDoseToken(expired)).toMatchObject({ ok: false, status: 400 });
    const wrongHh = createDoseToken({ hid: "hh-other", sid: slot, uid: elder, role: "elder" });
    expect(await redeemDoseToken(wrongHh)).toMatchObject({ ok: false, status: 403 });
  });

  it("a family member's link is only a witness and never marks the dose taken; a role cannot be claimed", async () => {
    const { createDoseToken, redeemDoseToken } = await import("../src/lib/doselink");
    const { family, slot } = await ids();
    expect(
      await redeemDoseToken(createDoseToken({ hid: householdId, sid: slot, uid: family, role: "elder" })),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      await redeemDoseToken(createDoseToken({ hid: householdId, sid: slot, uid: family, role: "family" })),
    ).toMatchObject({ ok: true, outcome: "witnessed" });
    const st = await kamla.get((await r.state()).GET);
    expect(st.json.doseSlots.find((d: { id: string }) => d.id === slot).status).toBe("pending");
  });

  it("GET never changes anything; the elder's own link confirms once and cannot be reused", async () => {
    const route = await import("../src/app/api/doses/link/route");
    const { createDoseToken } = await import("../src/lib/doselink");
    const { elder, slot } = await ids();
    const t = createDoseToken({ hid: householdId, sid: slot, uid: elder, role: "elder" });
    const g = await route.GET(new Request(`http://localhost/api/doses/link?t=${t}`));
    expect(g.status).toBe(200);
    expect(await g.text()).toContain("Yes, I took it");
    const before = await kamla.get((await r.state()).GET);
    expect(before.json.doseSlots.find((d: { id: string }) => d.id === slot).status).toBe("pending");
    const post = () => {
      const f = new FormData();
      f.set("t", t);
      return route.POST(new Request("http://localhost/api/doses/link", { method: "POST", body: f }));
    };
    expect((await post()).status).toBe(200);
    const after = await kamla.get((await r.state()).GET);
    expect(after.json.doseSlots.find((d: { id: string }) => d.id === slot).status).toBe("elder_confirmed");
    const again = await post();
    expect(again.status).toBe(409);
    expect(await again.text()).toMatch(/already (used|marked as taken)/);
  });
});

describe("reminder recipients", () => {
  it("upcoming-dose emails include the elder; personal links never go into the shared outbox", async () => {
    const { recipients, doseLinkFooter } = await import("../src/lib/reminders");
    const withElder = await recipients(householdId, true);
    expect(withElder.filter((x) => x.role === "elder")).toHaveLength(1);
    expect(withElder.some((x) => x.role === "caretaker")).toBe(false);
    expect((await recipients(householdId, false)).every((x) => x.role === "family")).toBe(true);
    const elder = withElder.find((x) => x.role === "elder")!;
    expect(doseLinkFooter(householdId, "slot-1", elder)).toMatch(/\/api\/doses\/link\?t=[\w-]+\.[\w-]+/);
    expect(doseLinkFooter(householdId, "slot-1", { email: "nobody@example.com", uid: null, role: null })).toBe("");
  });
});

describe("email verification (OTP)", () => {
  it("sign-up gives no session until the 6-digit code is verified; wrong codes are limited to 5", async () => {
    const a = new Agent();
    const s = await a.call((await r.signup()).POST, { name: "Otp", email: "otp@example.com", password: "password123" });
    expect(s.status).toBe(200);
    expect(s.json.needsVerification).toBe(true);
    expect(a.cookie).toBeUndefined();
    // cannot sign in before verifying
    const l = await new Agent().call((await r.login()).POST, { email: "otp@example.com", password: "password123" });
    expect(l.status).toBe(403);
    expect(l.json.needsVerification).toBe(true);
    const v = await import("../src/app/api/auth/verify/route");
    const wrong = String((Number(s.json.devCode) % 900000) + 100001).slice(0, 6);
    for (let i = 0; i < 5; i++)
      expect((await a.call(v.POST, { email: "otp@example.com", code: wrong })).status).toBeGreaterThanOrEqual(400);
    // locked after 5 wrong tries, even with the right code
    expect((await a.call(v.POST, { email: "otp@example.com", code: s.json.devCode })).status).toBe(429);
    expect(a.cookie).toBeUndefined();
  });

  it("codes are stored hashed, expire after 10 minutes, and resend has a cooldown", async () => {
    const a = new Agent();
    const s = await a.call((await r.signup()).POST, {
      name: "Otp2",
      email: "otp2@example.com",
      password: "password123",
    });
    const { getUserByEmail, getOtp } = await import("../src/lib/db");
    const u = (await getUserByEmail("otp2@example.com"))!;
    const row = (await getOtp(u.id))!;
    expect(row.code_hash).not.toContain(s.json.devCode);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    const resend = await import("../src/app/api/auth/resend/route");
    expect((await a.call(resend.POST, { email: "otp2@example.com" })).status).toBe(429);
    const { verifyOtp } = await import("../src/lib/otp");
    expect((await verifyOtp(u.id, String(s.json.devCode), Date.now() + 11 * 60_000)).ok).toBe(false);
    const ok = await (
      await import("../src/app/api/auth/verify/route")
    ).POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "otp2@example.com", code: s.json.devCode }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/apnahaath_session=/);
  });

  it("Google sign-in is disabled gracefully without credentials and uses the fixed callback URL", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const g = await import("../src/app/api/auth/google/route");
    const res = await g.GET(new Request("http://localhost/api/auth/google"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/auth_error=google_unavailable/);
    const { googleRedirectUri } = await import("../src/lib/google");
    process.env.APP_URL = "https://apnahaath-ramithas-projects-88e2a822.vercel.app";
    expect(googleRedirectUri()).toBe(
      "https://apnahaath-ramithas-projects-88e2a822.vercel.app/api/auth/google/callback",
    );
    delete process.env.APP_URL;
  });
});
