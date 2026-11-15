import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  listMedicines: vi.fn(),
}));

import { listMedicines } from "../src/lib/db";
import { checkThyronormShelcalGap, findEcosprinActive } from "../src/lib/rules";
import { dedupeCards } from "../src/lib/cards";
import type { DecisionCard } from "../src/lib/types";

const list = vi.mocked(listMedicines);

const med = (name: string, schedule_time: string, active = 1) => ({
  id: name,
  household_id: "hh",
  name,
  brand_hi: name,
  dose: "1",
  schedule_time,
  instructions: "",
  color_band: "blue",
  active,
  notes: null,
});

beforeEach(() => {
  list.mockReset();
});

describe("checkThyronormShelcalGap", () => {
  it("allows medicines that are not Thyronorm or Shelcal", async () => {
    list.mockResolvedValue([med("Telma 40", "08:00")]);
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Telma 40", scheduleTime: "08:00" })).toEqual({
      ok: true,
    });
  });

  it("allows Thyronorm when no calcium is on the list", async () => {
    list.mockResolvedValue([med("Telma 40", "08:00")]);
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Thyronorm 50", scheduleTime: "08:00" })).toEqual({
      ok: true,
    });
  });

  it("allows Shelcal when no thyroid medicine is on the list", async () => {
    list.mockResolvedValue([med("Telma 40", "08:00")]);
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Shelcal 500", scheduleTime: "08:00" })).toEqual({
      ok: true,
    });
  });

  it.each([
    { proposed: "Thyronorm 50", existing: "Shelcal 500", time: "08:00", other: "10:00", ok: false },
    { proposed: "Levothyroxine", existing: "calcium carbonate", time: "07:00", other: "10:59", ok: false },
    { proposed: "Thyrox 50", existing: "Shelcal", time: "06:00", other: "09:59", ok: false },
    { proposed: "Shelcal 500", existing: "Thyronorm 50", time: "12:00", other: "08:30", ok: false },
    { proposed: "Thyronorm 50", existing: "Shelcal 500", time: "08:00", other: "12:00", ok: true },
    { proposed: "Shelcal 500", existing: "Levothyrox", time: "16:00", other: "08:00", ok: true },
    { proposed: "calcium", existing: "Thyrox", time: "12:00", other: "08:00", ok: true },
  ])("$proposed at $time vs $existing at $other -> ok=$ok", async ({ proposed, existing, time, other, ok }) => {
    list.mockResolvedValue([med(existing, other)]);
    const r = await checkThyronormShelcalGap("hh", { medicineName: proposed, scheduleTime: time });
    expect(r.ok).toBe(ok);
    if (!ok && !r.ok) expect(r.message_en).toMatch(/4 hours/);
  });
});

describe("findEcosprinActive", () => {
  it("is true for Ecosprin or aspirin and false otherwise", async () => {
    list.mockResolvedValue([med("Telma 40", "08:00"), med("Ecosprin 75", "21:00")]);
    expect(await findEcosprinActive("hh")).toBe(true);
    list.mockResolvedValue([med("aspirin 75", "21:00")]);
    expect(await findEcosprinActive("hh")).toBe(true);
    list.mockResolvedValue([med("Telma 40", "08:00")]);
    expect(await findEcosprinActive("hh")).toBe(false);
    list.mockResolvedValue([]);
    expect(await findEcosprinActive("hh")).toBe(false);
  });
});

function card(
  partial: Partial<DecisionCard> & Pick<DecisionCard, "id" | "title" | "family_line_en" | "created_at">,
): DecisionCard {
  return {
    household_id: "h",
    source_event_id: null,
    severity: "info",
    elder_line_hi: "x",
    caretaker_line_hi: "x",
    tell_doctor: "x",
    disclaimer: "x",
    emergency_line: "x",
    cached: 0,
    ...partial,
  };
}

describe("dedupeCards", () => {
  it("dedupes notes that mention no known medicine by title", () => {
    const cards = [
      card({
        id: "old",
        title: "General reminder",
        family_line_en: "Please check in",
        created_at: "2026-11-15T09:00:00+05:30",
      }),
      card({
        id: "new",
        title: "General reminder",
        family_line_en: "A later check-in",
        created_at: "2026-11-15T11:00:00+05:30",
      }),
    ];
    expect(dedupeCards(cards, ["Thyronorm 50"]).map((c) => c.id)).toEqual(["new"]);
  });

  it("drops an older note whose medicines are a subset of a newer one", () => {
    const cards = [
      card({
        id: "broad",
        title: "Pain tablet review",
        family_line_en: "Brufen with Ecosprin and Telma",
        created_at: "2026-11-15T12:00:00+05:30",
      }),
      card({
        id: "narrow",
        title: "Older Brufen note",
        family_line_en: "Brufen with Ecosprin",
        created_at: "2026-11-15T10:00:00+05:30",
      }),
    ];
    expect(dedupeCards(cards, ["Brufen 400", "Ecosprin 75", "Telma 40"]).map((c) => c.id)).toEqual(["broad"]);
  });

  it("keeps notes about different medicines and ignores 1-2 letter tokens", () => {
    const cards = [
      card({
        id: "a",
        title: "Thyronorm timing",
        family_line_en: "Thyronorm in the morning",
        created_at: "2026-11-15T10:00:00+05:30",
      }),
      card({
        id: "b",
        title: "Shelcal timing",
        family_line_en: "Shelcal after lunch",
        created_at: "2026-11-15T11:00:00+05:30",
      }),
    ];
    expect(dedupeCards(cards, ["Thyronorm 50", "Shelcal 500", "AB"]).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("escapes regex metacharacters in medicine names", () => {
    const cards = [
      card({ id: "a", title: "Note", family_line_en: "C+Care was added", created_at: "2026-11-15T10:00:00+05:30" }),
    ];
    expect(() => dedupeCards(cards, ["C+Care"])).not.toThrow();
    expect(dedupeCards(cards, ["C+Care"]).map((c) => c.id)).toEqual(["a"]);
  });
});
