import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  listEvents: vi.fn(),
  listRecentSlots: vi.fn(),
}));
vi.mock("../src/lib/adaption", () => ({
  adaptionJson: vi.fn(),
}));

import { listEvents, listRecentSlots } from "../src/lib/db";
import { adaptionJson } from "../src/lib/adaption";
import {
  computeWeekStats,
  generateWeeklySummary,
  templateWeeklySummary,
  validateWeeklySummary,
} from "../src/lib/weekly";
import { MEDICAL_DISCLAIMER } from "../src/lib/constants";

const slots = vi.mocked(listRecentSlots);
const events = vi.mocked(listEvents);
const adapt = vi.mocked(adaptionJson);

const slot = (name: string, status: string, skip_reason: string | null = null) =>
  ({
    id: `${name}-${status}-${skip_reason ?? "x"}`,
    household_id: "hh",
    medicine_id: name,
    scheduled_at: "2026-11-14T08:00:00+05:30",
    status,
    skip_reason,
    medicine_name: name,
    brand_hi: name,
    color_band: "blue",
    instructions: "",
  }) as never;

beforeEach(() => {
  slots.mockReset();
  events.mockReset();
  adapt.mockReset();
});

describe("computeWeekStats", () => {
  it("counts confirmed, skipped, missed and pending doses and derives a rate", async () => {
    slots.mockResolvedValue([
      slot("Telma 40", "elder_confirmed"),
      slot("Telma 40", "elder_confirmed"),
      slot("Thyronorm 50", "missed"),
      slot("Shelcal 500", "skipped", "felt unwell"),
      slot("Shelcal 500", "skipped", "felt unwell"),
      slot("Shelcal 500", "skipped", "asleep"),
      slot("Glycomet", "pending"),
    ]);
    events.mockResolvedValue([
      { type: "witnessed", created_at: "2026-11-14T09:00:00+05:30" },
      { type: "witnessed", created_at: "2026-11-01T09:00:00+05:30" }, // outside the week
      { type: "self_added", created_at: "2026-11-14T12:00:00+05:30" },
    ] as never);
    const st = await computeWeekStats("hh");
    expect(st.confirmed).toBe(2);
    expect(st.missed).toBe(1);
    expect(st.skipped).toBe(3);
    expect(st.pending).toBe(1);
    expect(st.rate).toBe(67); // 2/3
    expect(st.witnessed).toBe(1);
    expect(st.selfAdded).toBe(1);
    expect(st.skipReasons).toEqual({ "felt unwell": 2, asleep: 1 });
    expect(st.mostMissed).toBe("Thyronorm 50");
    expect(st.perMedicine[0].name).toBe("Thyronorm 50");
    expect(st.from <= st.to).toBe(true);
  });

  it("uses a null rate and no mostMissed when nothing was confirmed or missed", async () => {
    slots.mockResolvedValue([slot("Telma 40", "pending"), slot("Telma 40", "skipped", "asleep")]);
    events.mockResolvedValue([]);
    const st = await computeWeekStats("hh");
    expect(st.rate).toBeNull();
    expect(st.mostMissed).toBeNull();
    expect(st.witnessed).toBe(0);
    expect(st.selfAdded).toBe(0);
  });
});

describe("validateWeeklySummary", () => {
  const ok = {
    elder: "Kamla ji, you confirmed several doses this week. Thank you.",
    caretaker: "Remind her around the morning time and let her mark it herself.",
    family:
      "This week the confirmation rate was steady. No prescription was changed. Mention missed doses to the doctor.",
  };

  it("accepts a safe summary", () => {
    expect(validateWeeklySummary(ok)).toEqual({ ok: true, summary: ok });
  });

  it("rejects a short elder line", () => {
    expect(validateWeeklySummary({ ...ok, elder: "Hi" }).ok).toBe(false);
  });

  it("rejects a summary that suggests a dose change", () => {
    const r = validateWeeklySummary({
      ...ok,
      family: "Please double the dose of Thyronorm next week after the visit.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dose\/prescription change/);
  });
});

describe("templateWeeklySummary", () => {
  it("mentions the confirmation rate, skip reasons, self-added medicines and the most missed medicine", () => {
    const st = {
      from: "2026-11-09",
      to: "2026-11-15",
      confirmed: 4,
      skipped: 1,
      missed: 2,
      pending: 0,
      witnessed: 3,
      selfAdded: 1,
      rate: 67,
      skipReasons: { "felt unwell": 1 },
      perMedicine: [{ name: "Thyronorm 50", confirmed: 0, skipped: 0, missed: 2 }],
      mostMissed: "Thyronorm 50",
    };
    const t = templateWeeklySummary(st, "Kamla Devi");
    expect(t.elder).toMatch(/Kamla ji, this week you confirmed 4 doses/);
    expect(t.caretaker).toMatch(/3 witnessed/);
    expect(t.caretaker).toMatch(/Gently remind Kamla around the Thyronorm 50 time/);
    expect(t.family).toMatch(/67%/);
    expect(t.family).toMatch(/felt unwell \(1\)/);
    expect(t.family).toMatch(/added 1 medicine/);
    expect(t.family).toMatch(/Most missed: Thyronorm 50/);
    expect(t.family).toMatch(/No prescription or dose was changed/);
  });

  it("uses the empty-week wording when there is no rate, no skips, no self-adds and no misses", () => {
    const st = {
      from: "2026-11-09",
      to: "2026-11-15",
      confirmed: 0,
      skipped: 0,
      missed: 0,
      pending: 2,
      witnessed: 0,
      selfAdded: 0,
      rate: null,
      skipReasons: {},
      perMedicine: [],
      mostMissed: null,
    };
    const t = templateWeeklySummary(st, "Kamla Devi");
    expect(t.elder).toMatch(/confirmed 0 doses/);
    expect(t.caretaker).toMatch(/Keep reminding Kamla/);
    expect(t.family).toMatch(/not enough doses yet/);
    expect(t.family).toMatch(/Skip reasons: none/);
    expect(t.family).toMatch(/No self-added medicines/);
    expect(t.family).toMatch(/No pattern of missed doses/);
  });
});

describe("generateWeeklySummary", () => {
  it("returns Adaption phrasing when it passes the guard", async () => {
    slots.mockResolvedValue([]);
    events.mockResolvedValue([]);
    const summary = {
      elder: "Kamla ji, thank you for confirming your doses this week.",
      caretaker: "Keep reminding her at each dose time and let her mark it herself.",
      family: "Rate is not computed yet because there were no confirmed or missed doses this week. All is well.",
    };
    adapt.mockResolvedValue(summary);
    const r = await generateWeeklySummary("hh", "Kamla Devi");
    expect(r.source).toBe("adaption");
    expect(r.summary).toEqual(summary);
    expect(r.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(r.error).toBeUndefined();
  });

  it("falls back to the template when Adaption fails or suggests a dose change", async () => {
    slots.mockResolvedValue([]);
    events.mockResolvedValue([]);
    adapt.mockRejectedValue(new Error("Adaption HTTP 503"));
    const r = await generateWeeklySummary("hh", "Kamla Devi");
    expect(r.source).toBe("template");
    expect(r.error).toBe("Adaption HTTP 503");
    expect(r.summary.elder).toMatch(/Kamla ji/);

    adapt.mockResolvedValue({
      elder: "Please stop taking Telma this week and tell the doctor later on.",
      caretaker: "Remind her around the morning time and let her mark it herself.",
      family: "A quiet week overall with no other concerns to share with the family today.",
    });
    const r2 = await generateWeeklySummary("hh", "Kamla Devi");
    expect(r2.source).toBe("template");
    expect(r2.error).toMatch(/dose\/prescription change/);
  });
});
