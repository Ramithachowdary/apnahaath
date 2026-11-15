import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDaysIst,
  formatIstIso,
  formatTime12,
  istDateTimeOnToday,
  minutesSince,
  parseIstMs,
  todayIstDateString,
} from "../src/lib/time";

describe("formatTime12", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["1:05", "1:05 AM"],
    ["09:00", "9:00 AM"],
    ["11:59", "11:59 AM"],
    ["12:00", "12:00 PM"],
    ["12:01", "12:01 PM"],
    ["13:00", "1:00 PM"],
    ["15:30", "3:30 PM"],
    ["23:59", "11:59 PM"],
    ["08:00:00", "8:00 AM"],
    ["2026-11-20T14:30:00+05:30", "2:30 PM"],
    ["2026-11-20T00:00:00+05:30", "12:00 AM"],
    ["2026-11-20T08:00:00+05:30", "8:00 AM"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatTime12(input)).toBe(expected);
  });

  it.each(["soon", "14.30", "25:00", "Txx:yy", ""])("returns the original value for %s", (input) => {
    expect(formatTime12(input)).toBe(input);
  });
});

describe("IST date helpers", () => {
  it("formatIstIso writes an Asia/Kolkata offset", () => {
    const iso = formatIstIso(new Date("2026-11-20T09:00:00.000Z"));
    expect(iso).toBe("2026-11-20T14:30:00+05:30");
  });

  it("todayIstDateString is a YYYY-MM-DD calendar date", () => {
    expect(todayIstDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("istDateTimeOnToday pins HH:MM onto today's IST date", () => {
    const value = istDateTimeOnToday("8:05");
    expect(value).toBe(`${todayIstDateString()}T08:05:00+05:30`);
  });

  it("parseIstMs understands an IST iso string", () => {
    expect(parseIstMs("2026-11-20T14:30:00+05:30")).toBe(Date.parse("2026-11-20T09:00:00.000Z"));
  });

  it("addDaysIst crosses month boundaries in IST", () => {
    expect(addDaysIst("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysIst("2026-11-20", -6)).toBe("2026-11-14");
    expect(addDaysIst("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("minutesSince is the elapsed minutes from an earlier instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:30:00.000Z"));
    expect(minutesSince("2026-11-20T14:30:00+05:30")).toBe(90);
    vi.useRealTimers();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
