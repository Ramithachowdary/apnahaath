import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listMedicines: vi.fn() }));
vi.mock("../src/lib/db", () => db);

import { checkThyronormShelcalGap, findEcosprinActive } from "../src/lib/rules";

const med = (name: string, schedule_time: string) => ({
  id: name,
  household_id: "hh",
  name,
  brand_hi: "",
  dose: "1",
  schedule_time,
  instructions: "",
  color_band: "",
  active: 1,
  notes: null,
});

describe("checkThyronormShelcalGap", () => {
  beforeEach(() => {
    db.listMedicines.mockReset();
  });

  it("allows an unrelated medicine and allows Thyronorm when no calcium is on the list", async () => {
    db.listMedicines.mockResolvedValue([med("Telma", "08:00")]);
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Telma", scheduleTime: "08:00" })).toEqual({
      ok: true,
    });
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Thyronorm 50", scheduleTime: "07:00" })).toEqual({
      ok: true,
    });
  });

  it.each([
    ["Thyronorm", "Shelcal", "07:00", "10:00"],
    ["Levothyroxine", "Calcium carbonate", "06:00", "09:30"],
    ["Thyrox", "Shelcal 500", "08:00", "11:00"],
  ])("rejects %s at %s vs %s at %s when closer than 4 hours", async (a, b, t1, t2) => {
    db.listMedicines.mockResolvedValue([med(b, t2)]);
    const result = await checkThyronormShelcalGap("hh", { medicineName: a, scheduleTime: t1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message_en).toMatch(/4 hours/);
  });

  it("allows a gap of exactly 4 hours and a wider gap", async () => {
    db.listMedicines.mockResolvedValue([med("Shelcal", "12:00")]);
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Thyronorm", scheduleTime: "08:00" })).toEqual({
      ok: true,
    });
    expect(await checkThyronormShelcalGap("hh", { medicineName: "Thyronorm", scheduleTime: "07:00" })).toEqual({
      ok: true,
    });
  });

  it("also applies when the proposed medicine is the calcium and Thyronorm is already listed", async () => {
    db.listMedicines.mockResolvedValue([med("Thyronorm 25", "07:00")]);
    const result = await checkThyronormShelcalGap("hh", { medicineName: "Shelcal", scheduleTime: "09:00" });
    expect(result.ok).toBe(false);
  });
});

describe("findEcosprinActive", () => {
  it.each([
    ["Ecosprin 75", true],
    ["aspirin", true],
    ["Low-dose Aspirin", true],
    ["Telma 40", false],
    ["Thyronorm", false],
  ])("%s -> %s", async (name, expected) => {
    db.listMedicines.mockResolvedValue(name ? [med(name, "08:00")] : []);
    expect(await findEcosprinActive("hh")).toBe(expected);
  });

  it("is false when the household has no medicines", async () => {
    db.listMedicines.mockResolvedValue([]);
    expect(await findEcosprinActive("hh")).toBe(false);
  });
});
