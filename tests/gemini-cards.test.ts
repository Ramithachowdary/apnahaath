import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMERGENCY_LINE, MEDICAL_DISCLAIMER } from "../src/lib/constants";

const db = vi.hoisted(() => ({
  listMedicines: vi.fn(),
  listEvents: vi.fn(),
}));
vi.mock("../src/lib/db", () => db);

import { generateDecisionCard, generateDoctorBrief, offlineBrufenCard, validateWarnOnlyCard } from "../src/lib/gemini";

const validCard = {
  severity: "review_required" as const,
  title: "Brufen safety review",
  elder_line_hi: "Please tell your doctor about the pain tablet you took today.",
  caretaker_line_hi: "Keep the usual schedule and let her mark the dose herself.",
  family_line_en: "A self-added pain tablet is on the log. No prescription was changed.",
  tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
  changes_prescription: false as const,
  dose_change: null,
};

describe("validateWarnOnlyCard", () => {
  it("accepts a complete warn-only card", () => {
    const result = validateWarnOnlyCard(validCard);
    expect(result.ok).toBe(true);
  });

  it("rejects missing required fields or a title that is too short", () => {
    expect(validateWarnOnlyCard({ ...validCard, title: "Hi" }).ok).toBe(false);
    expect(validateWarnOnlyCard({ ...validCard, changes_prescription: true }).ok).toBe(false);
  });

  it("rejects card text that implies a dose change", () => {
    const result = validateWarnOnlyCard({
      ...validCard,
      family_line_en: "Please double the dose of Thyronorm tonight after food.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/mutation/);
  });
});

describe("offlineBrufenCard", () => {
  it("builds a cached review card that never changes a prescription", () => {
    const card = offlineBrufenCard("hh-1", "evt-9");
    expect(card.household_id).toBe("hh-1");
    expect(card.source_event_id).toBe("evt-9");
    expect(card.severity).toBe("review_required");
    expect(card.cached).toBe(1);
    expect(card.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(card.emergency_line).toBe(EMERGENCY_LINE);
    expect(card.family_line_en).toMatch(/No prescription changed/);
    expect(card.id).toMatch(/^card-/);
  });
});

describe("generateDecisionCard", () => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    db.listMedicines.mockReset();
    db.listEvents.mockReset();
    db.listMedicines.mockResolvedValue([]);
    db.listEvents.mockResolvedValue([]);
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prevModel;
  });

  it("returns the offline Brufen card when no key is set and Ecosprin is active", async () => {
    delete process.env.GEMINI_API_KEY;
    db.listMedicines.mockResolvedValue([{ name: "Ecosprin 75", dose: "75", schedule_time: "20:00" }]);
    const result = await generateDecisionCard({
      hh: "hh-1",
      sourceEventId: "evt-1",
      context: "Elder self-added Brufen 400",
      medicineHint: "Brufen",
    });
    expect(result.source).toBe("offline");
    expect(result.card.title).toMatch(/Brufen \+ Ecosprin/);
  });

  it("returns a generic offline card when no key is set and the note is unrelated", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateDecisionCard({
      hh: "hh-1",
      sourceEventId: null,
      context: "Morning check-in",
    });
    expect(result.source).toBe("offline");
    expect(result.card.title).toBe("Care note (offline)");
    expect(result.card.family_line_en).toMatch(/Gemini key not configured/);
  });

  it("returns a validated Gemini card when the model replies with safe JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(validCard) + "\n```" }] } }],
        }),
      }),
    );
    const result = await generateDecisionCard({ hh: "hh-1", sourceEventId: "evt-2", context: "Pain tablet logged" });
    expect(result.source).toBe("gemini");
    expect(result.card.title).toBe(validCard.title);
    expect(result.card.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(result.card.cached).toBe(0);
  });

  it("falls back offline when Gemini suggests a dose change, and tries the next model on HTTP failure", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      ...validCard,
                      family_line_en: "Please double the dose of Telma tonight after dinner.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateDecisionCard({ hh: "hh-1", sourceEventId: null, context: "Routine note" });
    expect(result.source).toBe("offline");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.card.family_line_en).toMatch(/live Gemini output unavailable/);
  });
});

describe("generateDoctorBrief", () => {
  const prevKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    db.listEvents.mockResolvedValue([
      {
        created_at: "2026-11-14T10:00:00+05:30",
        type: "elder_confirmed",
        actor_name: "Kamla",
        medicine_id: "med-1",
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevKey;
  });

  it("returns the structured log when no Gemini key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    const brief = await generateDoctorBrief("hh-1", "Kamla Devi");
    expect(brief).toContain("Doctor brief — Kamla Devi");
    expect(brief).toContain(MEDICAL_DISCLAIMER);
    expect(brief).toContain("elder_confirmed by Kamla");
    expect(brief).toContain("No prescriptions were changed by software.");
  });

  it("returns Gemini's summary when it is safe", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Kamla confirmed her morning tablet. No other events." }] } }],
        }),
      }),
    );
    const brief = await generateDoctorBrief("hh-1", "Kamla Devi");
    expect(brief).toContain("Kamla confirmed her morning tablet");
    expect(brief).toContain(EMERGENCY_LINE);
    expect(brief).toContain(MEDICAL_DISCLAIMER);
  });

  it("falls back to the structured log if the summary suggests a dose change or Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Please increase the dose of Telma this week." }] } }],
        }),
      }),
    );
    const mutated = await generateDoctorBrief("hh-1", "Kamla Devi");
    expect(mutated).toContain("Doctor brief — Kamla Devi");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const failed = await generateDoctorBrief("hh-1", "Kamla Devi");
    expect(failed).toContain("Doctor brief — Kamla Devi");
  });
});
