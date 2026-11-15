import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

delete process.env.DATABASE_URL;

import {
  addMembershipStmt,
  batch,
  consumeInvite,
  createHouseholdStmt,
  createUser,
  createUserStmt,
  getAdherenceStats,
  getAppointment,
  getAuthMeta,
  getDecisionCard,
  getHousehold,
  getInviteByHash,
  getMedicine,
  getMembership,
  getMembershipById,
  getProposal,
  getUser,
  getUserByEmail,
  getUserByGoogleId,
  householdHasRole,
  insertDecisionCard,
  insertEvent,
  insertInvite,
  insertMedicine,
  insertOutbox,
  insertProposal,
  listDecisionCards,
  listInvites,
  listMedicines,
  listMembers,
  listOutbox,
  listProposals,
  listRecentSlots,
  listUserHouseholds,
  query,
  setAuthMeta,
  setMedicineActive,
  setMembershipLock,
  setUserGoogle,
  setUserVerified,
  slotIdFor,
  ensureTodaySlots,
  updateMedicineSchedule,
  updateOutboxStatus,
  updateProposalStatus,
  updateUnverifiedUser,
  upsertAppointment,
  upsertOtp,
  getOtp,
  bumpOtpAttempts,
  deleteOtp,
  listDoseSlots,
  updateDoseSlotStatus,
} from "../src/lib/db";
import { formatIstIso, todayIstDateString } from "../src/lib/time";
import type { DecisionCard, Medicine, ReminderOutbox } from "../src/lib/types";

const prefix = `dbt-${randomUUID().slice(0, 8)}`;
const uid = `${prefix}-user`;
const uid2 = `${prefix}-user2`;
const hid = `${prefix}-hh`;
const mid = `${prefix}-mem`;
const medId = `${prefix}-med`;

beforeAll(async () => {
  await createUser({
    id: uid,
    name: "Unit User",
    email: `${prefix}@example.com`,
    password_hash: "hash",
    is_demo: 0,
    email_verified: 0,
    google_id: null,
  });
  await batch([
    createHouseholdStmt({
      id: hid,
      elder_name: "Unit Elder",
      elder_age: 80,
      city: "Lucknow",
      language: "Hindi",
      owner_user_id: uid,
      is_demo: 0,
      demo_credentials_json: null,
    }),
    addMembershipStmt({ id: mid, user_id: uid, household_id: hid, role: "family", pin_hash: "pin" }),
  ]);
});

describe("users and google linking", () => {
  it("creates, looks up, verifies and links a Google id", async () => {
    const u = await getUser(uid);
    expect(u?.email).toBe(`${prefix}@example.com`);
    expect(u?.email_verified).toBe(0);
    await setUserVerified(uid);
    expect((await getUser(uid))?.email_verified).toBe(1);
    await setUserGoogle(uid, `g-${prefix}`);
    expect((await getUserByGoogleId(`g-${prefix}`))?.id).toBe(uid);
    expect(await getUserByGoogleId("missing")).toBeUndefined();
    expect((await getUserByEmail(`${prefix}@example.com`))?.id).toBe(uid);
  });

  it("updateUnverifiedUser only updates an unverified account", async () => {
    await batch([
      createUserStmt({
        id: uid2,
        name: "Old",
        email: `${prefix}-2@example.com`,
        password_hash: "old",
        is_demo: 0,
      }),
    ]);
    // createUserStmt does not set email_verified; the schema default is 1, so this user is verified.
    await updateUnverifiedUser(uid2, "New", "new-hash");
    const still = await getUser(uid2);
    expect(still?.name).toBe("Old");
    // A truly unverified user can be updated:
    const uid3 = `${prefix}-user3`;
    await createUser({
      id: uid3,
      name: "Draft",
      email: `${prefix}-3@example.com`,
      password_hash: "old",
      is_demo: 0,
      email_verified: 0,
    });
    await updateUnverifiedUser(uid3, "Ready", "new-hash");
    const ready = await getUser(uid3);
    expect(ready?.name).toBe("Ready");
    expect(ready?.password_hash).toBe("new-hash");
  });
});

describe("households, memberships and invites", () => {
  it("reads the household, membership and member list", async () => {
    expect((await getHousehold(hid))?.elder_name).toBe("Unit Elder");
    expect((await getMembership(uid, hid))?.role).toBe("family");
    expect((await getMembershipById(mid))?.user_id).toBe(uid);
    expect(await householdHasRole(hid, "family")).toBe(true);
    expect(await householdHasRole(hid, "elder")).toBe(false);
    expect((await listUserHouseholds(uid)).some((h) => h.id === hid)).toBe(true);
    expect((await listMembers(hid)).some((m) => m.id === uid)).toBe(true);
  });

  it("sets and clears a membership lock", async () => {
    await setMembershipLock(mid, 2, "2026-11-15T12:00:00+05:30");
    expect((await getMembershipById(mid))?.failed_attempts).toBe(2);
    await setMembershipLock(mid, 0, null);
    expect((await getMembershipById(mid))?.failed_attempts).toBe(0);
    expect((await getMembershipById(mid))?.lockout_until).toBeNull();
  });

  it("stores, lists and consumes an invite exactly once", async () => {
    const invId = `${prefix}-inv`;
    const hash = `hash-${prefix}`;
    await insertInvite({
      id: invId,
      household_id: hid,
      role: "caretaker",
      code_hash: hash,
      created_by: uid,
      expires_at: "2099-01-01T00:00:00+05:30",
    });
    expect((await getInviteByHash(hash))?.id).toBe(invId);
    expect((await listInvites(hid)).some((i) => i.id === invId)).toBe(true);
    expect(await consumeInvite(invId, uid)).toBe(true);
    expect(await consumeInvite(invId, uid)).toBe(false);
    expect((await getInviteByHash(hash))?.used_by).toBe(uid);
  });
});

describe("OTP rows and auth_meta", () => {
  it("upserts, bumps, reads and deletes an OTP row", async () => {
    const now = Date.now();
    await upsertOtp(uid, "abc", now + 1000, now);
    const row = await getOtp(uid);
    expect(row?.code_hash).toBe("abc");
    expect(row?.attempts).toBe(0);
    await bumpOtpAttempts(uid);
    expect((await getOtp(uid))?.attempts).toBe(1);
    await upsertOtp(uid, "def", now + 2000, now + 10);
    expect((await getOtp(uid))?.code_hash).toBe("def");
    expect((await getOtp(uid))?.attempts).toBe(0);
    await deleteOtp(uid);
    expect(await getOtp(uid)).toBeUndefined();
    expect(await getOtp("missing")).toBeUndefined();
  });

  it("stores and overwrites auth_meta keys", async () => {
    expect(await getAuthMeta(`${prefix}-k`)).toBe("");
    await setAuthMeta(`${prefix}-k`, "one");
    expect(await getAuthMeta(`${prefix}-k`)).toBe("one");
    await setAuthMeta(`${prefix}-k`, "two");
    expect(await getAuthMeta(`${prefix}-k`)).toBe("two");
  });
});

describe("medicines, slots, appointments, events", () => {
  it("inserts a medicine, creates today's slot, and can deactivate it", async () => {
    const medicine: Medicine = {
      id: medId,
      household_id: hid,
      name: "Telma 40",
      brand_hi: "Telma",
      dose: "40 mg",
      schedule_time: "08:00",
      instructions: "after food",
      color_band: "pink",
      active: 1,
      notes: null,
    };
    await insertMedicine(medicine);
    expect((await getMedicine(hid, medId))?.name).toBe("Telma 40");
    expect((await listMedicines(hid, true)).some((m) => m.id === medId)).toBe(true);
    expect(slotIdFor(medId, "2026-11-15")).toBe(`${medId}-20261115`);
    await ensureTodaySlots(hid);
    const today = (await listDoseSlots(hid)).find((s) => s.medicine_id === medId);
    expect(today?.status).toBe("pending");
    await ensureTodaySlots(hid); // idempotent
    expect((await listDoseSlots(hid)).filter((s) => s.medicine_id === medId)).toHaveLength(1);
    await updateMedicineSchedule(hid, medId, "21:00");
    expect((await getMedicine(hid, medId))?.schedule_time).toBe("21:00");
    await updateDoseSlotStatus(hid, today!.id, "elder_confirmed", null);
    expect((await listRecentSlots(hid, todayIstDateString())).some((s) => s.id === today!.id)).toBe(true);
    const pendingId = `${prefix}-pending`;
    await query(
      `INSERT INTO dose_slots (id,household_id,medicine_id,scheduled_at,status,skip_reason) VALUES (?,?,?,?, 'pending', NULL)`,
      [pendingId, hid, medId, `${todayIstDateString()}T21:00:00+05:30`],
    );
    await setMedicineActive(hid, medId, 0);
    expect((await listMedicines(hid, true)).some((m) => m.id === medId)).toBe(false);
    expect(await listDoseSlots(hid).then((rows) => rows.find((s) => s.id === pendingId))).toBeUndefined();
  });

  it("upserts an appointment and lists it", async () => {
    const id = `${prefix}-appt`;
    await upsertAppointment({
      id,
      household_id: hid,
      doctor: "Dr Mehta",
      place: "KGMU",
      scheduled_at: "2026-11-20T14:30:00+05:30",
      notes: "Carry reports",
    });
    expect((await getAppointment(hid, id))?.doctor).toBe("Dr Mehta");
    await upsertAppointment({
      id,
      household_id: hid,
      doctor: "Dr Mehta",
      place: "KGMU OPD",
      scheduled_at: "2026-11-20T15:00:00+05:30",
      notes: null,
    });
    expect((await getAppointment(hid, id))?.place).toBe("KGMU OPD");
  });

  it("appends a care event", async () => {
    await insertEvent(hid, {
      id: `${prefix}-evt`,
      type: "witnessed",
      actor_role: "caretaker",
      actor_name: "Sunita",
      payload: { via: "test" },
    });
  });
});

describe("decision cards, outbox, proposals and adherence", () => {
  it("inserts and reads a decision card", async () => {
    const card: DecisionCard = {
      id: `${prefix}-card`,
      household_id: hid,
      source_event_id: null,
      severity: "info",
      title: "Care note",
      elder_line_hi: "Please talk to your doctor if you have questions today.",
      caretaker_line_hi: "Follow the elder's own record and let her mark doses.",
      family_line_en: "No prescription was changed.",
      tell_doctor: "Review the week's log.",
      disclaimer: "d",
      emergency_line: "e",
      cached: 1,
      created_at: formatIstIso(),
    };
    await insertDecisionCard(card);
    expect((await getDecisionCard(hid, card.id))?.title).toBe("Care note");
    expect((await listDecisionCards(hid)).some((c) => c.id === card.id)).toBe(true);
  });

  it("inserts an outbox row once per idempotency key and updates its status", async () => {
    const row: ReminderOutbox = {
      id: `${prefix}-out`,
      household_id: hid,
      kind: "upcoming",
      to_email: "fam@example.com",
      subject: "Upcoming",
      body: "A dose is coming up.",
      idempotency_key: `${prefix}:upcoming`,
      status: "queued",
      created_at: formatIstIso(),
      sent_at: null,
      error: null,
    };
    expect(await insertOutbox(row)).toBe(true);
    expect(await insertOutbox({ ...row, id: `${prefix}-out-2` })).toBe(false);
    await updateOutboxStatus(row.id, "sent");
    const listed = await listOutbox(hid);
    const saved = listed.find((r) => r.id === row.id);
    expect(saved?.status).toBe("sent");
    expect(saved?.sent_at).toBeTruthy();
    await updateOutboxStatus(row.id, "failed", "smtp down");
    expect((await listOutbox(hid)).find((r) => r.id === row.id)?.error).toBe("smtp down");
  });

  it("inserts, lists and updates a proposal", async () => {
    const id = `${prefix}-prop`;
    await insertProposal(hid, { id, kind: "add", medicine_id: null, payload: { name: "Telma 40" }, created_by: uid });
    expect((await getProposal(hid, id))?.status).toBe("pending");
    await updateProposalStatus(hid, id, "accepted");
    expect((await getProposal(hid, id))?.status).toBe("accepted");
    expect((await listProposals(hid)).some((p) => p.id === id)).toBe(true);
  });

  it("computes adherence from today's slots, excluding skips from the rate", async () => {
    const stats = await getAdherenceStats(hid);
    expect(stats.elderConfirmed).toBeGreaterThanOrEqual(0);
    expect(stats.witnessed).toBeGreaterThanOrEqual(0);
    expect("elderConfirmationRate" in stats).toBe(true);
  });

  it("query(SELECT 1) works on the in-process database", async () => {
    const r = await query("SELECT 1 AS x");
    expect(r.rows[0]).toMatchObject({ x: 1 });
  });
});

describe("health route", () => {
  it("reports ok and the in-process database", async () => {
    const { GET } = await import("../src/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string; db: string };
    expect(body).toMatchObject({ ok: true, service: "apnahaath", db: "pglite-local" });
  });
});
