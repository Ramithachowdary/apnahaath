import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEDICAL_DISCLAIMER } from "../src/lib/constants";

const db = vi.hoisted(() => ({
  listRecentSlots: vi.fn(),
  listEvents: vi.fn(),
}));
vi.mock("../src/lib/db", () => db);

const adaption = vi.hoisted(() => ({ adaptionJson: vi.fn() }));
vi.mock("../src/lib/adaption", () => adaption);

import {
  computeWeekStats,
  generateWeeklySummary,
  templateWeeklySummary,
  validateWeeklySummary,
  type WeekStats,
} from "../src/lib/weekly";

const emptyStats = (): WeekStats => ({
  from: "2026-11-09",
  to: "2026-11-15",
  confirmed: 0,
  skipped: 0,
  missed: 0,
  pending: 0,
  witnessed: 0,
  selfAdded: 0,
  rate: null,
  skipReasons: {},
  perMedicine: [],
  mostMissed: null,
});

describe("validateWeeklySummary", () => {
  const ok = {
    elder: "Kamla ji, thank you for confirming your doses this week.",
    caretaker: "Remind her at the usual times and let her mark each dose herself.",
    family: "This week the confirmation rate was steady. Mention the missed morning tablet to the doctor.",
  };

  it("accepts a safe summary", () => {
    expect(validateWeeklySummary(ok)).toEqual({ ok: true, summary: ok });
  });

  it("rejects short or incomplete JSON", () => {
    expect(validateWeeklySummary({ elder: "Hi", caretaker: "Go", family: "Short" }).ok).toBe(false);
  });

  it("rejects a summary that tells someone to change a dose", () => {
    const result = validateWeeklySummary({ ...ok, family: "Please increase the dose of Telma this week, family." });
    expect(result).toEqual({ ok: false, error: "Summary implies a dose/prescription change" });
  });
});

describe("templateWeeklySummary", () => {
  it("uses a 'not enough doses' rate and the default reminder when nothing was missed", () => {
    const text = templateWeeklySummary(emptyStats(), "Kamla Devi");
    expect(text.elder).toContain("Kamla ji");
    expect(text.elder).toContain("confirmed 0 doses");
    expect(text.caretaker).toContain("Keep reminding Kamla");
    expect(text.family).toContain("not enough doses yet");
    expect(text.family).toContain("Skip reasons: none.");
    expect(text.family).toContain("No self-added medicines this week.");
    expect(text.family).toContain("No pattern of missed doses.");
    expect(text.family).toContain("No prescription or dose was changed by ApnaHaath.");
  });

  it("names the most missed medicine, lists skip reasons and self-added counts", () => {
    const text = templateWeeklySummary(
      {
        ...emptyStats(),
        confirmed: 8,
        missed: 2,
        skipped: 1,
        witnessed: 3,
        selfAdded: 1,
        rate: 80,
        skipReasons: { Asleep: 1 },
        mostMissed: "Thyronorm",
        perMedicine: [{ name: "Thyronorm", confirmed: 5, skipped: 0, missed: 2 }],
      },
      "Kamla Devi",
    );
    expect(text.caretaker).toContain("around the Thyronorm time");
    expect(text.family).toContain("Elder-confirmation rate: 80%");
    expect(text.family).toContain("Asleep (1)");
    expect(text.family).toContain("Kamla added 1 medicine(s) herself");
    expect(text.family).toContain("Most missed: Thyronorm");
  });
});

describe("computeWeekStats", () => {
  beforeEach(() => {
    db.listRecentSlots.mockReset();
    db.listEvents.mockReset();
  });

  it("counts statuses, skip reasons, witnesses and the confirmation rate", async () => {
    db.listRecentSlots.mockResolvedValue([
      { medicine_name: "Thyronorm", status: "elder_confirmed", skip_reason: null },
      { medicine_name: "Thyronorm", status: "missed", skip_reason: null },
      { medicine_name: "Shelcal", status: "skipped", skip_reason: "Asleep" },
      { medicine_name: "Shelcal", status: "skipped", skip_reason: null },
      { medicine_name: "Telma", status: "pending", skip_reason: null },
    ]);
    db.listEvents.mockResolvedValue([
      { type: "witnessed", created_at: "2026-11-14T10:00:00+05:30" },
      { type: "witnessed", created_at: "2026-11-14T11:00:00+05:30" },
      { type: "self_added", created_at: "2026-11-14T12:00:00+05:30" },
      { type: "witnessed", created_at: "2000-01-01T00:00:00+05:30" },
    ]);
    const stats = await computeWeekStats("hh-1");
    expect(stats.confirmed).toBe(1);
    expect(stats.missed).toBe(1);
    expect(stats.skipped).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.rate).toBe(50);
    expect(stats.skipReasons).toEqual({ Asleep: 1, "No reason": 1 });
    expect(stats.witnessed).toBe(2);
    expect(stats.selfAdded).toBe(1);
    expect(stats.mostMissed).toBe("Thyronorm");
    expect(stats.perMedicine[0].name).toBe("Thyronorm");
    expect(stats.from < stats.to || stats.from === stats.to).toBe(true);
  });

  it("returns a null rate and no most-missed when every slot is still pending", async () => {
    db.listRecentSlots.mockResolvedValue([{ medicine_name: "Telma", status: "pending", skip_reason: null }]);
    db.listEvents.mockResolvedValue([]);
    const stats = await computeWeekStats("hh-1");
    expect(stats.rate).toBeNull();
    expect(stats.mostMissed).toBeNull();
    expect(stats.pending).toBe(1);
  });
});

describe("generateWeeklySummary", () => {
  beforeEach(() => {
    db.listRecentSlots.mockResolvedValue([]);
    db.listEvents.mockResolvedValue([]);
    adaption.adaptionJson.mockReset();
  });

  it("returns Adaption wording when the JSON is safe", async () => {
    const summary = {
      elder: "Kamla ji, thank you for a steady week of confirmations.",
      caretaker: "Keep the same reminder routine and let her mark each dose.",
      family: "Confirmation was steady this week. Mention the log at the next visit.",
    };
    adaption.adaptionJson.mockResolvedValue(summary);
    const result = await generateWeeklySummary("hh-1", "Kamla Devi");
    expect(result.source).toBe("adaption");
    expect(result.summary).toEqual(summary);
    expect(result.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(result.error).toBeUndefined();
  });

  it("falls back to the template when Adaption implies a dose change or throws", async () => {
    adaption.adaptionJson.mockResolvedValue({
      elder: "Kamla ji, thank you for confirming your doses this week.",
      caretaker: "Remind her at the usual times and let her mark each dose herself.",
      family: "Please double the dose of Thyronorm this week and tell the doctor later.",
    });
    const rejected = await generateWeeklySummary("hh-1", "Kamla Devi");
    expect(rejected.source).toBe("template");
    expect(rejected.error).toMatch(/dose\/prescription change/);

    adaption.adaptionJson.mockRejectedValue(new Error("timeout"));
    const failed = await generateWeeklySummary("hh-1", "Kamla Devi");
    expect(failed.source).toBe("template");
    expect(failed.error).toBe("timeout");
    expect(failed.summary.elder).toContain("Kamla ji");
  });
});
