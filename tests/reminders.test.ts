import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  ensureTodaySlots: vi.fn(),
  getHousehold: vi.fn(),
  insertEvent: vi.fn(),
  insertOutbox: vi.fn(),
  listAppointments: vi.fn(),
  listDoseSlots: vi.fn(),
  listMembers: vi.fn(),
  updateDoseSlotStatus: vi.fn(),
}));
const mail = vi.hoisted(() => ({ deliverOutboxRow: vi.fn() }));
const gemini = vi.hoisted(() => ({ translateCareMessage: vi.fn() }));

vi.mock("../src/lib/db", () => db);
vi.mock("../src/lib/email", () => mail);
vi.mock("../src/lib/gemini", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/gemini")>("../src/lib/gemini");
  return { ...actual, translateCareMessage: gemini.translateCareMessage };
});

import { doseLinkFooter, familyRecipients, recipients, runMorningCheck } from "../src/lib/reminders";
import { MISS_GRACE_MINUTES } from "../src/lib/constants";
import { SITE_URL } from "../src/lib/site";

const members = [
  { id: "e1", name: "Kamla", email: "elder@example.com", role: "elder" as const },
  { id: "c1", name: "Ravi", email: "care@example.com", role: "caretaker" as const },
  { id: "f1", name: "Meera", email: "family@example.com", role: "family" as const },
];

describe("recipients and doseLinkFooter", () => {
  beforeEach(() => {
    db.listMembers.mockResolvedValue(members);
  });

  it("includes the elder only when asked, and never includes the caretaker", async () => {
    const familyOnly = await recipients("hh-1", false);
    expect(familyOnly.map((r) => r.email)).toEqual(["family@example.com"]);
    const withElder = await recipients("hh-1", true);
    expect(withElder.map((r) => r.role)).toEqual(["elder", "family"]);
    expect(await familyRecipients("hh-1")).toEqual(["family@example.com"]);
  });

  it("builds a personal one-tap link for the elder and a witness link for family", () => {
    const elder = doseLinkFooter("hh-1", "slot-1", { email: "elder@example.com", uid: "e1", role: "elder" });
    expect(elder).toContain("Took it?");
    expect(elder).toContain(`${SITE_URL}/api/doses/link?t=`);
    expect(elder).toContain("only for you");

    const family = doseLinkFooter("hh-1", "slot-1", { email: "family@example.com", uid: "f1", role: "family" });
    expect(family).toContain("witness");
    expect(family).toContain("does not mark it taken");
    expect(family).toContain(`${SITE_URL}/api/doses/link?t=`);
  });

  it("returns an empty footer when the recipient has no user id or role", () => {
    expect(doseLinkFooter("hh-1", "slot-1", { email: "x@y.com", uid: null, role: null })).toBe("");
  });
});

describe("runMorningCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z")); // 15:30 IST
    for (const fn of Object.values(db)) fn.mockReset();
    mail.deliverOutboxRow.mockReset();
    gemini.translateCareMessage.mockReset();
    db.ensureTodaySlots.mockResolvedValue(undefined);
    db.getHousehold.mockResolvedValue({ elder_name: "Kamla Devi", language: "Hindi" });
    db.listMembers.mockResolvedValue(members);
    db.listAppointments.mockResolvedValue([]);
    db.listDoseSlots.mockResolvedValue([]);
    db.insertOutbox.mockResolvedValue(true);
    db.insertEvent.mockResolvedValue(undefined);
    db.updateDoseSlotStatus.mockResolvedValue(undefined);
    mail.deliverOutboxRow.mockResolvedValue(undefined);
    gemini.translateCareMessage.mockImplementation(async (text: string) => `HI:${text}`);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queues an upcoming reminder for a dose in the next hour, with a translated elder body", async () => {
    // 15:30 IST now; 16:00 IST is 30 minutes away (age = -30)
    db.listDoseSlots.mockResolvedValue([
      {
        id: "slot-up",
        medicine_id: "med-1",
        medicine_name: "Thyronorm",
        scheduled_at: "2026-11-20T16:00:00+05:30",
        status: "pending",
      },
    ]);
    const result = await runMorningCheck("hh-1");
    expect(result.queued).toBe(2); // elder + family
    expect(gemini.translateCareMessage).toHaveBeenCalled();
    expect(mail.deliverOutboxRow).toHaveBeenCalledTimes(2);
    const elderRow = mail.deliverOutboxRow.mock.calls.find((c) => c[0].to_email === "elder@example.com");
    const familyRow = mail.deliverOutboxRow.mock.calls.find((c) => c[0].to_email === "family@example.com");
    expect(elderRow?.[0].body).toMatch(/^HI:/);
    expect(familyRow?.[0].body).not.toMatch(/^HI:/);
    expect(elderRow?.[2]).toContain("Took it?");
    expect(familyRow?.[2]).toContain("witness");
    expect(elderRow?.[0].subject).toBe("ApnaHaath: a dose is coming up");
    expect(elderRow?.[0].subject).not.toMatch(/Thyronorm/);
  });

  it("marks a stale pending dose missed and does not nag skipped or confirmed doses", async () => {
    const stale = "2026-11-20T12:00:00+05:30"; // 210 minutes ago, past 90-minute grace
    db.listDoseSlots.mockResolvedValue([
      { id: "slot-miss", medicine_id: "m1", medicine_name: "Shelcal", scheduled_at: stale, status: "pending" },
      { id: "slot-skip", medicine_id: "m1", medicine_name: "Shelcal", scheduled_at: stale, status: "skipped" },
      { id: "slot-ok", medicine_id: "m1", medicine_name: "Shelcal", scheduled_at: stale, status: "elder_confirmed" },
    ]);
    const result = await runMorningCheck("hh-1");
    expect(db.updateDoseSlotStatus).toHaveBeenCalledWith("hh-1", "slot-miss", "missed", null);
    expect(db.insertEvent).toHaveBeenCalledWith(
      "hh-1",
      expect.objectContaining({ type: "missed", payload: { grace_minutes: MISS_GRACE_MINUTES } }),
    );
    expect(result.queued).toBe(1); // family only (no slotId on missed queue)
    expect(mail.deliverOutboxRow.mock.calls[0][0].to_email).toBe("family@example.com");
    expect(mail.deliverOutboxRow.mock.calls[0][0].subject).toBe("ApnaHaath: a dose was not confirmed");
  });

  it("queues an appointment reminder inside the 24-hour window and skips already-queued mail", async () => {
    db.listAppointments.mockResolvedValue([
      {
        id: "appt-1",
        doctor: "Dr Mehta",
        place: "KGMU",
        scheduled_at: "2026-11-20T16:00:00+05:30",
        notes: "Carry reports",
      },
    ]);
    db.insertOutbox.mockResolvedValue(false);
    const result = await runMorningCheck("hh-1");
    expect(result.queued).toBe(0);
    expect(db.insertOutbox).toHaveBeenCalled();
    expect(mail.deliverOutboxRow).not.toHaveBeenCalled();
  });
});
