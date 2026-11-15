import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db", () => ({
  listMedicines: vi.fn(),
  listEvents: vi.fn(),
}));
vi.mock("../src/lib/rules", () => ({
  findEcosprinActive: vi.fn(),
}));

import { listEvents, listMedicines } from "../src/lib/db";
import { findEcosprinActive } from "../src/lib/rules";
import {
  generateDecisionCard,
  generateDoctorBrief,
  offlineBrufenCard,
  translateCareMessage,
  validateWarnOnlyCard,
} from "../src/lib/gemini";

const listMeds = vi.mocked(listMedicines);
const listEv = vi.mocked(listEvents);
const ecosprin = vi.mocked(findEcosprinActive);

const safeCard = {
  severity: "review_required",
  title: "Brufen and Ecosprin review",
  elder_line_hi: "Please talk to your doctor about this combination today.",
  caretaker_line_hi: "Please keep a note of the pain tablet she already took.",
  family_line_en: "Self-reported Brufen with Ecosprin on record. Potential interaction needs clinician review.",
  tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
  changes_prescription: false,
  dose_change: null,
};

function geminiResponse(text: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

beforeEach(() => {
  listMeds.mockResolvedValue([]);
  listEv.mockResolvedValue([]);
  ecosprin.mockResolvedValue(false);
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe("offlineBrufenCard", () => {
  it("builds a cached review card that does not change the prescription", () => {
    const card = offlineBrufenCard("hh-1", "evt-1");
    expect(card.household_id).toBe("hh-1");
    expect(card.source_event_id).toBe("evt-1");
    expect(card.severity).toBe("review_required");
    expect(card.cached).toBe(1);
    expect(card.title).toMatch(/Brufen/);
    expect(card.family_line_en).toMatch(/No prescription changed/);
    expect(validateWarnOnlyCard({ ...card, changes_prescription: false, dose_change: null }).ok).toBe(true);
  });
});

describe("generateDecisionCard", () => {
  it("uses the Brufen + Ecosprin offline card when no Gemini key is set", async () => {
    ecosprin.mockResolvedValue(true);
    const r = await generateDecisionCard({
      hh: "hh",
      sourceEventId: "evt",
      context: "Kamla added Brufen 400",
      medicineHint: "Brufen",
    });
    expect(r.source).toBe("offline");
    expect(r.card.title).toMatch(/Brufen \+ Ecosprin/);
  });

  it("uses a generic offline card when no key is set and Ecosprin is not active", async () => {
    const r = await generateDecisionCard({ hh: "hh", sourceEventId: null, context: "A late dose was noted" });
    expect(r.source).toBe("offline");
    expect(r.card.title).toBe("Care note (offline)");
    expect(r.card.family_line_en).toMatch(/Gemini key not configured/);
  });

  it("returns a Gemini card when the model replies with valid warn-only JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(safeCard)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await generateDecisionCard({ hh: "hh", sourceEventId: "evt", context: "Brufen added" });
    expect(r.source).toBe("gemini");
    expect(r.card.title).toBe(safeCard.title);
    expect(r.card.cached).toBe(0);
    expect(r.card.disclaimer).toMatch(/not a doctor/i);
    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/gemini-3.5-flash|gemini-flash-lite-latest/);
  });

  it("strips markdown fences around Gemini JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("```json\n" + JSON.stringify(safeCard) + "\n```")));
    const r = await generateDecisionCard({ hh: "hh", sourceEventId: null, context: "note" });
    expect(r.source).toBe("gemini");
    expect(r.card.title).toBe(safeCard.title);
  });

  it("falls back to the generic offline card when Gemini suggests a dose change", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          geminiResponse(
            JSON.stringify({ ...safeCard, family_line_en: "Please stop taking Telma today after talking it over." }),
          ),
        ),
    );
    const r = await generateDecisionCard({ hh: "hh", sourceEventId: null, context: "note" });
    expect(r.source).toBe("offline");
    expect(r.card.family_line_en).toMatch(/unavailable or rejected/);
  });

  it("falls back to the Brufen card when Gemini fails and Ecosprin is active", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    ecosprin.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("nope", false, 500)));
    const r = await generateDecisionCard({
      hh: "hh",
      sourceEventId: null,
      context: "added ibuprofen",
      medicineHint: "ibuprofen",
    });
    expect(r.source).toBe("offline");
    expect(r.card.title).toMatch(/Brufen \+ Ecosprin/);
  });

  it("tries the next Gemini model when the first one fails", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse("fail", false, 404))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(safeCard)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await generateDecisionCard({ hh: "hh", sourceEventId: null, context: "note" });
    expect(r.source).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses GEMINI_MODEL when it is set", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-custom-test";
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(safeCard)));
    vi.stubGlobal("fetch", fetchMock);
    await generateDecisionCard({ hh: "hh", sourceEventId: null, context: "note" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-custom-test");
  });
});

describe("generateDoctorBrief", () => {
  it("returns the template brief when no Gemini key is set", async () => {
    listEv.mockResolvedValue([
      {
        id: "e1",
        household_id: "hh",
        type: "elder_confirmed",
        actor_role: "elder",
        actor_name: "Kamla",
        medicine_id: "med-1",
        dose_slot_id: "s1",
        appointment_id: null,
        payload_json: "{}",
        created_at: "2026-11-15T08:00:00+05:30",
      },
    ] as never);
    const brief = await generateDoctorBrief("hh", "Kamla Devi");
    expect(brief).toMatch(/Doctor brief: Kamla Devi/);
    expect(brief).toMatch(/elder_confirmed/);
    expect(brief).toMatch(/No prescriptions were changed/);
  });

  it("uses a safe Gemini summary and appends the emergency line", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    listEv.mockResolvedValue([]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(geminiResponse("Kamla confirmed her morning dose. No other events this week.")),
    );
    const brief = await generateDoctorBrief("hh", "Kamla Devi");
    expect(brief).toMatch(/Kamla confirmed her morning dose/);
    expect(brief).toMatch(/Emergency: call 108/);
    expect(brief).toMatch(/not a doctor/i);
  });

  it("falls back to the template when Gemini suggests a dose change", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    listEv.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("Please double the dose of Thyronorm tonight.")));
    const brief = await generateDoctorBrief("hh", "Kamla Devi");
    expect(brief).toMatch(/Doctor brief: Kamla Devi/);
    expect(brief).not.toMatch(/double the dose/);
  });

  it("falls back to the template when Gemini is unavailable", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    listEv.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const brief = await generateDoctorBrief("hh", "Kamla Devi");
    expect(brief).toMatch(/Doctor brief: Kamla Devi/);
  });

  it("strips markdown and a trailing consult-the-doctor sign-off", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    listEv.mockResolvedValue([]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(geminiResponse("**Week summary**\n- Morning dose confirmed\n\nPlease consult your doctor.")),
    );
    const brief = await generateDoctorBrief("hh", "Kamla Devi");
    expect(brief).toMatch(/Morning dose confirmed/);
    expect(brief).not.toMatch(/\*\*/);
    expect(brief).not.toMatch(/Please consult your doctor/);
  });
});

describe("translateCareMessage extra cases", () => {
  it("returns the original text when the input is empty", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(await translateCareMessage("   ", "Hindi")).toBe("   ");
  });

  it("falls back when Gemini returns an empty translation", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("   ")));
    const original = "A dose is coming up.";
    expect(await translateCareMessage(original, "Hindi")).toBe(original);
  });

  it("treats ENGLISH in any case as a skip", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const msg = "A dose is coming up.";
    expect(await translateCareMessage(msg, "ENGLISH")).toBe(msg);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
