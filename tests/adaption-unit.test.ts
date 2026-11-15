import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMERGENCY_LINE } from "../src/lib/constants";
import { adaptionJson, generateCareMessages, templateMessages, validateCareMessages } from "../src/lib/adaption";
import type { DecisionCard } from "../src/lib/types";

const card: DecisionCard = {
  id: "card-1",
  household_id: "hh",
  source_event_id: "evt",
  severity: "review_required",
  title: "Brufen and Ecosprin review",
  elder_line_hi: "Please talk to your doctor about this combination today.",
  caretaker_line_hi: "Please keep a note of the pain tablet she already took.",
  family_line_en: "Self-reported Brufen with Ecosprin on record.",
  tell_doctor: "Mention self-added Brufen alongside Ecosprin 75.",
  disclaimer: "x",
  emergency_line: EMERGENCY_LINE,
  cached: 0,
  created_at: "2026-11-15T10:00:00+05:30",
};

const safeMessages = {
  elder: "Kamla ji, please tell the doctor about the pain tablet.",
  caretaker: "Please keep a note and let her mark the dose herself.",
  family: "Brufen was added today. No prescription was changed by the app. Mention this at the visit.",
};

beforeEach(() => {
  delete process.env.ADAPTION_API_KEY;
  delete process.env.ADAPTION_STACK_ID;
  delete process.env.ADAPTION_MODEL;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ADAPTION_API_KEY;
  delete process.env.ADAPTION_STACK_ID;
  delete process.env.ADAPTION_MODEL;
});

describe("validateCareMessages", () => {
  it("accepts three role-specific messages", () => {
    expect(validateCareMessages(safeMessages)).toEqual({ ok: true, messages: safeMessages });
  });

  it("rejects short or missing fields", () => {
    expect(validateCareMessages({ elder: "hi", caretaker: "ok", family: "too short" }).ok).toBe(false);
  });

  it("rejects messages that imply a dose change", () => {
    const r = validateCareMessages({
      ...safeMessages,
      caretaker: "Please stop taking Telma until the next visit.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dose\/prescription change/);
  });
});

describe("templateMessages", () => {
  it("keeps an elder line that already addresses her with ji", () => {
    const withJi = { ...card, elder_line_hi: "Kamla ji, please talk to your doctor today about this." };
    const m = templateMessages(withJi, "Kamla Devi");
    expect(m.elder).toBe(withJi.elder_line_hi);
    expect(m.caretaker).toBe(card.caretaker_line_hi);
    expect(m.family).toMatch(/Brufen and Ecosprin review/);
    expect(m.family).toMatch(/For the doctor:/);
    expect(m.family).toMatch(/No prescription or dose was changed/);
    expect(m.family).toContain(EMERGENCY_LINE);
    expect(m.family).toMatch(/AM|PM/);
  });

  it("prefixes the elder's first name when the line has no ji", () => {
    const m = templateMessages(card, "Kamla Devi");
    expect(m.elder).toBe("Kamla ji, Please talk to your doctor about this combination today.");
  });
});

describe("adaptionJson", () => {
  it("throws when the API key is missing", async () => {
    await expect(adaptionJson("do a thing", { a: 1 })).rejects.toThrow(/ADAPTION_API_KEY/);
  });

  it("parses fenced JSON from a successful response and uses a stack id", async () => {
    process.env.ADAPTION_API_KEY = "key";
    process.env.ADAPTION_STACK_ID = "care-stack";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: '```json\n{"ok":true}\n```' }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(adaptionJson("instructions", { n: 1 }, 200)).resolves.toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("stack:care-stack");
    expect(body.max_output_tokens).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer key");
  });

  it("throws on a non-OK HTTP response", async () => {
    process.env.ADAPTION_API_KEY = "key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    await expect(adaptionJson("x", {})).rejects.toThrow(/Adaption HTTP 503/);
  });
});

describe("generateCareMessages", () => {
  it("falls back to the template when no key is set", async () => {
    const r = await generateCareMessages(card, "Kamla Devi");
    expect(r.source).toBe("template");
    expect(r.error).toMatch(/ADAPTION_API_KEY/);
    expect(r.messages.elder).toMatch(/Kamla ji/);
  });

  it("returns Adaption messages when they pass the dose-change guard", async () => {
    process.env.ADAPTION_API_KEY = "key";
    process.env.ADAPTION_MODEL = "gemma-test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify(safeMessages) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await generateCareMessages(card, "Kamla Devi");
    expect(r).toEqual({ messages: safeMessages, source: "adaption" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("gemma-test");
  });

  it("falls back when Adaption suggests a dose change", async () => {
    process.env.ADAPTION_API_KEY = "key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({ ...safeMessages, family: "Please stop taking Telma from tonight onwards." }),
        }),
      }),
    );
    const r = await generateCareMessages(card, "Kamla Devi");
    expect(r.source).toBe("template");
    expect(r.error).toMatch(/dose\/prescription change/);
  });

  it("falls back when Adaption is unavailable", async () => {
    process.env.ADAPTION_API_KEY = "key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const r = await generateCareMessages(card, "Kamla Devi");
    expect(r.source).toBe("template");
    expect(r.error).toBe("network");
  });
});
