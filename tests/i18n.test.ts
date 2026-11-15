import { describe, expect, it } from "vitest";
import { LANGS, MESSAGE_KEYS, missingKeys, normalizeLang, t } from "@/lib/i18n";

describe("i18n dictionary", () => {
  it("every language has every key, with non-empty text", () => {
    for (const lang of ["en", "hi", "ta", "te"] as const) {
      expect(missingKeys(lang)).toEqual([]);
      for (const k of MESSAGE_KEYS) expect(t(lang, k).trim().length).toBeGreaterThan(0);
    }
  });

  it("offers English, Hindi, Tamil and Telugu with native labels", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["en", "hi", "ta", "te"]);
    expect(LANGS.map((l) => l.label)).toEqual(["English", "हिन्दी", "தமிழ்", "తెలుగు"]);
  });

  it("falls back to English for keys a language lacks", () => {
    // An unknown key at runtime (e.g. stale cached bundle) still renders English, never undefined.
    const ghost = "nav.ghost" as Parameters<typeof t>[1];
    expect(t("ta", ghost)).toBe("nav.ghost");
    expect(t("en", ghost)).toBe("nav.ghost");
    expect(t("te", "nav.today")).toBe("ఈరోజు");
    expect(t("ta", "nav.today")).toBe("இன்று");
  });

  it("translates and fills placeholders", () => {
    expect(t("en", "nav.today")).toBe("Today");
    expect(t("hi", "nav.today")).toBe("आज");
    expect(t("en", "today.takenCount", { taken: 2, total: 3 })).toBe("2 of 3 taken today");
    expect(t("hi", "check.progress", { done: 1, total: 4 })).toBe("4 में से 1 पूरे");
    expect(t("en", "today.nextFor", {})).toBe("Next for {name}");
    expect(t("en", "nav.history", { x: 1 })).toBe("History");
  });

  it("English UI has no emoji or default Hindi words", () => {
    for (const k of MESSAGE_KEYS) {
      expect(t("en", k)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t("en", k)).not.toMatch(/[\u0900-\u097F]/);
    }
  });

  it("normalizes unknown or empty values to English", () => {
    expect(normalizeLang("hi")).toBe("hi");
    expect(normalizeLang("HI-in")).toBe("hi");
    expect(normalizeLang("te")).toBe("te");
    expect(normalizeLang("fr")).toBe("en");
    expect(normalizeLang(null)).toBe("en");
    expect(normalizeLang(undefined)).toBe("en");
    expect(normalizeLang("")).toBe("en");
  });
});
