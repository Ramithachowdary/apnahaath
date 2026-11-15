import { describe, expect, it, vi, afterEach } from "vitest";
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
    { value: "00:00", out: "12:00 AM" },
    { value: "00:01", out: "12:01 AM" },
    { value: "08:00", out: "8:00 AM" },
    { value: "8:05", out: "8:05 AM" },
    { value: "09:59", out: "9:59 AM" },
    { value: "11:59", out: "11:59 AM" },
    { value: "12:00", out: "12:00 PM" },
    { value: "12:01", out: "12:01 PM" },
    { value: "13:30", out: "1:30 PM" },
    { value: "16:00", out: "4:00 PM" },
    { value: "23:59", out: "11:59 PM" },
    { value: "08:00:00", out: "8:00 AM" },
    { value: "2026-11-15T16:00:00+05:30", out: "4:00 PM" },
    { value: "2026-11-15T00:00:00+05:30", out: "12:00 AM" },
    { value: "2026-11-15T12:00:00Z", out: "12:00 PM" },
  ])("$value -> $out", ({ value, out }) => {
    expect(formatTime12(value)).toBe(out);
  });

  it.each(["soon", "25:00", "99:99", "ab:cd", "", "Txx:yy", "24:00"])(
    "returns the original string when %s is not a clock time",
    (value) => {
      expect(formatTime12(value)).toBe(value);
    },
  );
});

describe("IST date helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatIstIso uses a +05:30 offset and zero-padded parts", () => {
    // 2026-11-15 10:00 UTC = 15:30 IST
    const iso = formatIstIso(new Date("2026-11-15T10:00:00.000Z"));
    expect(iso).toBe("2026-11-15T15:30:00+05:30");
  });

  it("formatIstIso crosses the IST date line correctly", () => {
    // 2026-11-14 20:00 UTC = 2026-11-15 01:30 IST
    expect(formatIstIso(new Date("2026-11-14T20:00:00.000Z"))).toBe("2026-11-15T01:30:00+05:30");
  });

  it("todayIstDateString is the first 10 characters of formatIstIso", () => {
    const now = new Date("2026-03-31T20:00:00.000Z"); // 2026-04-01 01:30 IST
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(todayIstDateString()).toBe("2026-04-01");
  });

  it("istDateTimeOnToday pins HH:MM to today's IST date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00.000Z"));
    expect(istDateTimeOnToday("8:05")).toBe("2026-11-15T08:05:00+05:30");
    expect(istDateTimeOnToday("23:30")).toBe("2026-11-15T23:30:00+05:30");
  });

  it.each([
    { day: "2026-11-15", days: 0, out: "2026-11-15" },
    { day: "2026-11-15", days: 1, out: "2026-11-16" },
    { day: "2026-11-15", days: -6, out: "2026-11-09" },
    { day: "2026-11-30", days: 1, out: "2026-12-01" },
    { day: "2026-12-31", days: 1, out: "2027-01-01" },
    { day: "2026-03-31", days: 1, out: "2026-04-01" },
  ])("addDaysIst($day, $days) = $out", ({ day, days, out }) => {
    expect(addDaysIst(day, days)).toBe(out);
  });

  it("parseIstMs and minutesSince agree with Date.parse", () => {
    const iso = "2026-11-15T08:00:00+05:30";
    expect(parseIstMs(iso)).toBe(Date.parse(iso));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(iso) + 45 * 60_000));
    expect(minutesSince(iso)).toBe(45);
    vi.setSystemTime(new Date(Date.parse(iso) - 30 * 60_000));
    expect(minutesSince(iso)).toBe(-30);
  });
});
