import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "test-session-secret-32chars!!";
process.env.NEXT_PUBLIC_SITE_URL = "https://apnahaath-care.vercel.app";

vi.mock("../src/lib/db", () => ({
  ensureTodaySlots: vi.fn(),
  getHousehold: vi.fn(),
  insertEvent: vi.fn(),
  insertOutbox: vi.fn(),
  listAppointments: vi.fn(),
  listDoseSlots: vi.fn(),
  listMembers: vi.fn(),
  updateDoseSlotStatus: vi.fn(),
}));
vi.mock("../src/lib/email", () => ({
  deliverOutboxRow: vi.fn(),
}));
vi.mock("../src/lib/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/gemini")>();
  return { ...actual, translateCareMessage: vi.fn(async (text: string) => `HI:${text}`) };
});

import {
  ensureTodaySlots,
  getHousehold,
  insertEvent,
  insertOutbox,
  listAppointments,
  listDoseSlots,
  listMembers,
  updateDoseSlotStatus,
} from "../src/lib/db";
import { deliverOutboxRow } from "../src/lib/email";
import { translateCareMessage } from "../src/lib/gemini";
import { doseLinkFooter, familyRecipients, recipients, runMorningCheck } from "../src/lib/reminders";
import { formatIstIso } from "../src/lib/time";

const ensure = vi.mocked(ensureTodaySlots);
const household = vi.mocked(getHousehold);
const event = vi.mocked(insertEvent);
const outbox = vi.mocked(insertOutbox);
const appts = vi.mocked(listAppointments);
const slots = vi.mocked(listDoseSlots);
const members = vi.mocked(listMembers);
const update = vi.mocked(updateDoseSlotStatus);
const deliver = vi.mocked(deliverOutboxRow);
const translate = vi.mocked(translateCareMessage);

const memberList = [
  { id: "elder-uid", name: "Kamla", email: "kamla@example.com", role: "elder" as const, is_demo: 0 },
  { id: "care-uid", name: "Sunita", email: "sunita@example.com", role: "caretaker" as const, is_demo: 0 },
  { id: "fam-uid", name: "Priya", email: "priya@example.com", role: "family" as const, is_demo: 0 },
];

beforeEach(() => {
  ensure.mockReset().mockResolvedValue(undefined);
  household.mockReset().mockResolvedValue({
    id: "hh",
    elder_name: "Kamla Devi",
    elder_age: 74,
    city: "Lucknow",
    language: "Hindi",
    owner_user_id: "fam-uid",
    is_demo: 0,
    demo_credentials_json: null,
    created_at: "2026-11-15T08:00:00+05:30",
  });
  event.mockReset().mockResolvedValue(undefined);
  outbox.mockReset().mockResolvedValue(true);
  appts.mockReset().mockResolvedValue([]);
  slots.mockReset().mockResolvedValue([]);
  members.mockReset().mockResolvedValue(memberList);
  update.mockReset().mockResolvedValue(undefined);
  deliver.mockReset().mockResolvedValue(undefined);
  translate.mockReset().mockImplementation(async (text: string) => `HI:${text}`);
});

describe("recipients and doseLinkFooter", () => {
  it("includes the elder only when asked, and never includes the caretaker", async () => {
    const withElder = await recipients("hh", true);
    expect(withElder.map((r) => r.role).sort()).toEqual(["elder", "family"]);
    expect(await familyRecipients("hh")).toEqual(["priya@example.com"]);
    expect((await recipients("hh", false)).every((r) => r.role === "family")).toBe(true);
  });

  it("builds an elder confirmation link and a witness link, and is empty without a uid", () => {
    const elder = doseLinkFooter("hh", "slot-1", { email: "kamla@example.com", uid: "elder-uid", role: "elder" });
    expect(elder).toMatch(/Took it\?/);
    expect(elder).toMatch(/https:\/\/apnahaath-care\.vercel\.app\/api\/doses\/link\?t=/);
    const care = doseLinkFooter("hh", "slot-1", { email: "sunita@example.com", uid: "care-uid", role: "caretaker" });
    expect(care).toMatch(/witness/);
    expect(care).not.toMatch(/marks it taken|Took it/);
    expect(doseLinkFooter("hh", "slot-1", { email: "x@example.com", uid: null, role: null })).toBe("");
  });
});

describe("runMorningCheck", () => {
  it("queues an upcoming-dose email to the elder (translated) and the family, and delivers a personal link", async () => {
    const scheduled = formatIstIso(new Date(Date.now() + 30 * 60_000));
    slots.mockResolvedValue([
      {
        id: "slot-up",
        household_id: "hh",
        medicine_id: "med-1",
        scheduled_at: scheduled,
        status: "pending",
        skip_reason: null,
        medicine_name: "Thyronorm 50",
        brand_hi: "Thyronorm",
        color_band: "blue",
        instructions: "",
      },
    ] as never);
    const r = await runMorningCheck("hh");
    expect(r.queued).toBe(2);
    expect(translate).toHaveBeenCalled();
    const elderRow = outbox.mock.calls.map((c) => c[0]).find((row) => row.to_email === "kamla@example.com");
    expect(elderRow?.body).toMatch(/^HI:/);
    expect(elderRow?.subject).toBe("ApnaHaath: a dose is coming up");
    expect(elderRow?.body).not.toMatch(/\/api\/doses\/link/);
    const footer = deliver.mock.calls.find((c) => c[0].to_email === "kamla@example.com")?.[2];
    expect(footer).toMatch(/Took it\?/);
    const familyRow = outbox.mock.calls.map((c) => c[0]).find((row) => row.to_email === "priya@example.com");
    expect(familyRow?.body).not.toMatch(/^HI:/);
    expect(familyRow?.body).toMatch(/Thyronorm 50/);
    expect(familyRow?.body).toMatch(/AM|PM/);
  });

  it("marks a late pending dose as missed, logs an event, and emails only the family", async () => {
    const scheduled = formatIstIso(new Date(Date.now() - 2 * 60 * 60_000));
    slots.mockResolvedValue([
      {
        id: "slot-miss",
        household_id: "hh",
        medicine_id: "med-1",
        scheduled_at: scheduled,
        status: "pending",
        skip_reason: null,
        medicine_name: "Telma 40",
        brand_hi: "Telma",
        color_band: "blue",
        instructions: "",
      },
    ] as never);
    const r = await runMorningCheck("hh");
    expect(update).toHaveBeenCalledWith("hh", "slot-miss", "missed", null);
    expect(event).toHaveBeenCalledWith("hh", expect.objectContaining({ type: "missed", actor_role: "system" }));
    expect(r.queued).toBe(1);
    expect(outbox.mock.calls[0][0].to_email).toBe("priya@example.com");
    expect(outbox.mock.calls[0][0].kind).toBe("missed");
    expect(outbox.mock.calls[0][0].subject).toMatch(/not confirmed/);
  });

  it("does not nag confirmed or skipped doses", async () => {
    const late = formatIstIso(new Date(Date.now() - 3 * 60 * 60_000));
    slots.mockResolvedValue([
      {
        id: "a",
        household_id: "hh",
        medicine_id: "m",
        scheduled_at: late,
        status: "elder_confirmed",
        skip_reason: null,
        medicine_name: "T",
        brand_hi: "T",
        color_band: "b",
        instructions: "",
      },
      {
        id: "b",
        household_id: "hh",
        medicine_id: "m",
        scheduled_at: late,
        status: "skipped",
        skip_reason: "asleep",
        medicine_name: "T",
        brand_hi: "T",
        color_band: "b",
        instructions: "",
      },
    ] as never);
    const r = await runMorningCheck("hh");
    expect(r.queued).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(outbox).not.toHaveBeenCalled();
  });

  it("queues an appointment reminder in the 24-hour window", async () => {
    appts.mockResolvedValue([
      {
        id: "appt-1",
        household_id: "hh",
        doctor: "Dr Mehta",
        place: "KGMU, Lucknow",
        scheduled_at: formatIstIso(new Date(Date.now() + 2 * 60 * 60_000)),
        notes: "Carry reports",
      },
    ]);
    const r = await runMorningCheck("hh");
    expect(r.queued).toBe(1);
    expect(outbox.mock.calls[0][0].kind).toBe("appointment");
    expect(outbox.mock.calls[0][0].body).toMatch(/Dr Mehta/);
    expect(outbox.mock.calls[0][0].body).toMatch(/Carry reports/);
    expect(outbox.mock.calls[0][0].body).toMatch(/AM|PM/);
  });

  it("is idempotent when insertOutbox returns false", async () => {
    const scheduled = formatIstIso(new Date(Date.now() + 30 * 60_000));
    slots.mockResolvedValue([
      {
        id: "slot-up",
        household_id: "hh",
        medicine_id: "med-1",
        scheduled_at: scheduled,
        status: "pending",
        skip_reason: null,
        medicine_name: "Thyronorm 50",
        brand_hi: "T",
        color_band: "b",
        instructions: "",
      },
    ] as never);
    outbox.mockResolvedValue(false);
    const r = await runMorningCheck("hh");
    expect(r.queued).toBe(0);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("falls back to 'your elder' and English when the household row is missing", async () => {
    household.mockResolvedValue(undefined);
    members.mockResolvedValue([memberList[2]]);
    const scheduled = formatIstIso(new Date(Date.now() + 20 * 60_000));
    slots.mockResolvedValue([
      {
        id: "slot-up",
        household_id: "hh",
        medicine_id: "med-1",
        scheduled_at: scheduled,
        status: "pending",
        skip_reason: null,
        medicine_name: "Thyronorm 50",
        brand_hi: "T",
        color_band: "b",
        instructions: "",
      },
    ] as never);
    await runMorningCheck("hh");
    expect(outbox.mock.calls[0][0].body).toMatch(/your elder has Thyronorm 50/i);
  });
});
