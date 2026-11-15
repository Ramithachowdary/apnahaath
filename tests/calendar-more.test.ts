import { describe, expect, it } from "vitest";
import { googleCalendarUrl, normalizeAppointmentIso } from "../src/lib/calendar";

describe("normalizeAppointmentIso", () => {
  it.each([
    { in: "2026-11-20T14:30", out: "2026-11-20T14:30:00+05:30" },
    { in: "  2026-11-20T14:30  ", out: "2026-11-20T14:30:00+05:30" },
    { in: "2026-11-20T14:30:00", out: "2026-11-20T14:30:00+05:30" },
    { in: "2026-11-20T14:30:00+05:30", out: "2026-11-20T14:30:00+05:30" },
    { in: "2026-11-20T09:00:00Z", out: "2026-11-20T09:00:00Z" },
    { in: "2026-11-20T09:00:00z", out: "2026-11-20T09:00:00z" },
    { in: "2026-11-20T14:30:00+0530", out: "2026-11-20T14:30:00+0530" },
    { in: "2026-11-20T09:00:00-00:00", out: "2026-11-20T09:00:00-00:00" },
    { in: "not-a-date", out: "not-a-date" },
  ])("normalize($in) -> $out", (row) => {
    expect(normalizeAppointmentIso(row.in)).toBe(row.out);
  });
});

describe("googleCalendarUrl", () => {
  it("omits location and details when they are not provided", () => {
    const url = new URL(googleCalendarUrl({ title: "Review", startIso: "2026-11-20T14:30:00+05:30" }));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Review");
    expect(url.searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("details")).toBe(false);
  });

  it("uses a custom duration for the end time", () => {
    const url = googleCalendarUrl({
      title: "Scan",
      startIso: "2026-11-20T14:30:00+05:30",
      durationMinutes: 30,
    });
    expect(new URL(url).searchParams.get("dates")).toBe("20261120T090000Z/20261120T093000Z");
  });

  it("accepts a Zulu start time and a datetime with seconds but no offset", () => {
    const fromZ = googleCalendarUrl({ title: "A", startIso: "2026-11-20T09:00:00Z", durationMinutes: 60 });
    expect(new URL(fromZ).searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
    const fromLocal = googleCalendarUrl({ title: "B", startIso: "2026-11-20T14:30:00" });
    expect(new URL(fromLocal).searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
  });

  it("throws on an invalid appointment time", () => {
    expect(() => googleCalendarUrl({ title: "Bad", startIso: "next Tuesday" })).toThrow(/Invalid appointment time/);
  });
});
