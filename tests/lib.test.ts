import { afterEach, describe, expect, it, vi } from "vitest";
import { googleCalendarUrl, normalizeAppointmentIso } from "../src/lib/calendar";
import { rejectsMutation, translateCareMessage } from "../src/lib/gemini";

describe("Google Calendar template links", () => {
  it("builds a TEMPLATE url in UTC from an IST appointment", () => {
    const url = googleCalendarUrl({
      title: "Dr Mehta — Kamla Devi",
      startIso: "2026-11-20T14:30:00+05:30",
      location: "King George Medical University, Lucknow",
      details: "Carry previous reports",
      durationMinutes: 60,
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
    expect(parsed.searchParams.get("text")).toBe("Dr Mehta — Kamla Devi");
    expect(parsed.searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
    expect(parsed.searchParams.get("location")).toBe("King George Medical University, Lucknow");
    expect(parsed.searchParams.get("details")).toBe("Carry previous reports");
  });

  it("treats a datetime-local value with no offset as IST", () => {
    expect(normalizeAppointmentIso("2026-11-20T14:30")).toBe("2026-11-20T14:30:00+05:30");
    const url = googleCalendarUrl({ title: "Review", startIso: "2026-11-20T14:30" });
    expect(new URL(url).searchParams.get("dates")).toBe("20261120T090000Z/20261120T100000Z");
  });
});

describe("translateCareMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("returns the original text for English or when no Gemini key is set", async () => {
    const msg = "Kamla Devi has Thyronorm due at 8:00 AM IST.";
    expect(await translateCareMessage(msg, "English")).toBe(msg);
    expect(await translateCareMessage(msg, "")).toBe(msg);
    process.env.GEMINI_API_KEY = "";
    expect(await translateCareMessage(msg, "Hindi")).toBe(msg);
  });

  it("returns the translation when Gemini replies safely", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "कमला देवी की थायरोनॉर्म की खुराक सुबह 8:00 बजे है।" }] } }],
        }),
      }),
    );
    const out = await translateCareMessage("Kamla Devi has Thyronorm due at 8:00 AM IST.", "Hindi");
    expect(out).toContain("थायरोनॉर्म");
  });

  it("falls back to the original text if the translation suggests a dose change", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Please double the dose of Thyronorm tonight." }] } }],
        }),
      }),
    );
    const original = "Kamla Devi has Thyronorm due at 8:00 AM IST.";
    expect(rejectsMutation("Please double the dose of Thyronorm tonight.")).toBe(true);
    expect(await translateCareMessage(original, "Hindi")).toBe(original);
  });

  it("falls back to the original text when Gemini is unavailable", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const original = "A dose is coming up.";
    expect(await translateCareMessage(original, "Tamil")).toBe(original);
  });
});
