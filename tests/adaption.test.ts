import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMERGENCY_LINE } from "../src/lib/constants";
import type { DecisionCard } from "../src/lib/types";
import { generateCareMessages, templateMessages, validateCareMessages, adaptionJson } from "../src/lib/adaption";

const card: DecisionCard = {
  id: "card-1",
  household_id: "hh-1",
  source_event_id: "evt-1",
  severity: "review_required",
  title: "Brufen + Ecosprin",
  elder_line_hi: "Kamla ji, tell your doctor about the pain tablet you took today.",
  caretaker_line_hi: "Please keep the usual schedule and let her mark the dose herself.",
  family_line_en: "Self-added Brufen is on the log. No prescription was changed.",
  tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
  disclaimer: "disclaimer",
  emergency_line: EMERGENCY_LINE,
  cached: 0,
  created_at: "2026-11-15T10:00:00+05:30",
};

const safeMessages = {
  elder: "Kamla ji, please mention the pain tablet to your doctor.",
  caretaker: "Keep the usual schedule and let her mark it herself.",
  family: "A self-added pain tablet is on the log. Nothing was changed. Tell the doctor at the next visit.",
};

describe("validateCareMessages", () => {
  it("accepts a well-formed warn-only trio", () => {
    expect(validateCareMessages(safeMessages)).toEqual({ ok: true, messages: safeMessages });
  });

  it.each([
    ["missing family", { elder: "Hello there, Kamla.", caretaker: "Please check in kindly." }],
    ["too short", { elder: "Hi", caretaker: "Go", family: "Too short" }],
    ["not an object", "please double the dose"],
  ])("rejects %s", (_label, raw) => {
    const result = validateCareMessages(raw);
    expect(result.ok).toBe(false);
  });

  it("rejects a trio that implies a dose change", () => {
    const result = validateCareMessages({
      ...safeMessages,
      family: "Please double the dose of Thyronorm tonight and tell us.",
    });
    expect(result).toEqual({ ok: false, error: "Message implies a dose/prescription change" });
  });
});

describe("templateMessages", () => {
  it("keeps an elder line that already addresses her as ji", () => {
    const messages = templateMessages(card, "Kamla Devi");
    expect(messages.elder).toBe(card.elder_line_hi);
    expect(messages.caretaker).toBe(card.caretaker_line_hi);
    expect(messages.family).toContain(card.title);
    expect(messages.family).toContain(card.family_line_en);
    expect(messages.family).toContain(`For the doctor: ${card.tell_doctor}`);
    expect(messages.family).toContain("No prescription or dose was changed by ApnaHaath.");
    expect(messages.family).toContain(EMERGENCY_LINE);
    expect(messages.family).toMatch(/IST:/);
  });

  it("prefixes the elder's first name when the line has no ji", () => {
    const messages = templateMessages(
      { ...card, elder_line_hi: "Please sit and rest after the tablet." },
      "Kamla Devi",
    );
    expect(messages.elder).toBe("Kamla ji, Please sit and rest after the tablet.");
  });
});

describe("generateCareMessages / adaptionJson", () => {
  const prevKey = process.env.ADAPTION_API_KEY;
  const prevStack = process.env.ADAPTION_STACK_ID;
  const prevModel = process.env.ADAPTION_MODEL;

  beforeEach(() => {
    delete process.env.ADAPTION_STACK_ID;
    delete process.env.ADAPTION_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (prevKey === undefined) delete process.env.ADAPTION_API_KEY;
    else process.env.ADAPTION_API_KEY = prevKey;
    if (prevStack === undefined) delete process.env.ADAPTION_STACK_ID;
    else process.env.ADAPTION_STACK_ID = prevStack;
    if (prevModel === undefined) delete process.env.ADAPTION_MODEL;
    else process.env.ADAPTION_MODEL = prevModel;
  });

  it("falls back to the template when no Adaption key is set", async () => {
    delete process.env.ADAPTION_API_KEY;
    const result = await generateCareMessages(card, "Kamla Devi");
    expect(result.source).toBe("template");
    expect(result.error).toMatch(/ADAPTION_API_KEY/);
    expect(result.messages).toEqual(templateMessages(card, "Kamla Devi"));
  });

  it("uses Adaption output when the JSON is safe", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(safeMessages) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateCareMessages(card, "Kamla Devi");
    expect(result).toEqual({ messages: safeMessages, source: "adaption" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.prod.adaptionlabs.ai/api/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("gemma-4-31b-it");
    expect(body.temperature).toBe(0.3);
  });

  it("strips fenced JSON and uses a stack model id when configured", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    process.env.ADAPTION_STACK_ID = "care-voice";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: "```json\n" + JSON.stringify(safeMessages) + "\n```" }),
      }),
    );
    const result = await generateCareMessages(card, "Kamla Devi");
    expect(result.source).toBe("adaption");
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.model).toBe("stack:care-voice");
  });

  it("falls back when Adaption suggests a dose change", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            ...safeMessages,
            family: "Please double the dose of Thyronorm tonight, family.",
          }),
        }),
      }),
    );
    const result = await generateCareMessages(card, "Kamla Devi");
    expect(result.source).toBe("template");
    expect(result.error).toMatch(/dose\/prescription change/);
    expect(result.messages.elder).toBe(card.elder_line_hi);
  });

  it("falls back on HTTP errors, invalid JSON and network failures", async () => {
    process.env.ADAPTION_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    expect((await generateCareMessages(card, "Kamla Devi")).source).toBe("template");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "not-json" }) }));
    expect((await generateCareMessages(card, "Kamla Devi")).source).toBe("template");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect((await generateCareMessages(card, "Kamla Devi")).source).toBe("template");
  });

  it("adaptionJson throws without a key and parses a successful response", async () => {
    delete process.env.ADAPTION_API_KEY;
    await expect(adaptionJson("instr", { a: 1 })).rejects.toThrow("ADAPTION_API_KEY not set");

    process.env.ADAPTION_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: '{"ok":true}' }) }));
    await expect(adaptionJson("instr", { a: 1 }, 50)).resolves.toEqual({ ok: true });
  });
});
