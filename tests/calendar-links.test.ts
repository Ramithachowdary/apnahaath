import { describe, expect, it } from "vitest";
import { googleCalendarUrl, normalizeAppointmentIso } from "../src/lib/calendar";

describe("normalizeAppointmentIso", () => {
  it.each([
    ["2026-11-20T14:30", "2026-11-20T14:30:00+05:30"],
    ["2026-11-20T14:30:00", "2026-11-20T14:30:00+05:30"],
    ["2026-11-20T14:30:00+05:30", "2026-11-20T14:30:00+05:30"],
    ["2026-11-20T09:00:00Z", "2026-11-20T09:00:00Z"],
    ["2026-11-20T09:00:00.000Z", "2026-11-20T09:00:00.000Z"],
    ["2026-11-20T14:30:00+0530", "2026-11-20T14:30:00+0530"],
    [" 2026-11-20T14:30 ", "2026-11-20T14:30:00+05:30"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeAppointmentIso(input)).toBe(expected);
  });

  it("leaves unrecognised values unchanged", () => {
    expect(normalizeAppointmentIso("next Tuesday")).toBe("next Tuesday");
  });
});

describe("googleCalendarUrl", () => {
  it("defaults to a 60-minute event and omits empty optional fields", () => {
    const url = new URL(googleCalendarUrl({ title: "Review", startIso: "2026-11-20T14:30" }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Review");
    expect(url.searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
    expect(url.searchParams.get("location")).toBeNull();
    expect(url.searchParams.get("details")).toBeNull();
  });

  it("honours a custom duration and optional fields", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "Blood test",
        startIso: "2026-11-20T08:00:00+05:30",
        location: "Lucknow",
        details: "Fasting",
        durationMinutes: 30,
      }),
    );
    expect(url.searchParams.get("dates")).toBe("20261120T023000Z/20261120T030000Z");
    expect(url.searchParams.get("location")).toBe("Lucknow");
    expect(url.searchParams.get("details")).toBe("Fasting");
  });

  it("accepts a UTC Z stamp and a datetime already in IST", () => {
    const fromZ = new URL(googleCalendarUrl({ title: "A", startIso: "2026-11-20T09:00:00Z", durationMinutes: 15 }));
    expect(fromZ.searchParams.get("dates")).toBe("20261120T090000Z/20261120T091500Z");
    const fromIst = new URL(googleCalendarUrl({ title: "B", startIso: "2026-11-20T14:30:00+05:30" }));
    expect(fromIst.searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
  });

  it("throws on an invalid appointment time", () => {
    expect(() => googleCalendarUrl({ title: "X", startIso: "not-a-date" })).toThrow("Invalid appointment time");
  });
});
