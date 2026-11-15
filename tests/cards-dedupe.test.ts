import { describe, expect, it } from "vitest";
import { dedupeCards } from "../src/lib/cards";
import type { DecisionCard } from "../src/lib/types";

function card(partial: Partial<DecisionCard> & Pick<DecisionCard, "id" | "title" | "created_at">): DecisionCard {
  return {
    household_id: "hh",
    source_event_id: null,
    severity: "info",
    elder_line_hi: "Please mention this to your doctor today.",
    caretaker_line_hi: "Let her mark the dose herself as usual.",
    family_line_en: "Safety note for the log.",
    tell_doctor: "Review the log.",
    disclaimer: "d",
    emergency_line: "e",
    cached: 0,
    ...partial,
  };
}

describe("dedupeCards", () => {
  it("keeps the newest note when two mention the same medicines", () => {
    const older = card({
      id: "old",
      title: "Brufen warning",
      family_line_en: "Brufen with Ecosprin needs a review.",
      created_at: "2026-11-14T10:00:00+05:30",
    });
    const newer = card({
      id: "new",
      title: "Updated Brufen warning",
      family_line_en: "Brufen with Ecosprin is still on the log.",
      created_at: "2026-11-15T10:00:00+05:30",
    });
    const out = dedupeCards([older, newer], ["Brufen 400", "Ecosprin 75"]);
    expect(out.map((c) => c.id)).toEqual(["new"]);
  });

  it("drops an older note whose medicines are a subset of a newer one", () => {
    const broad = card({
      id: "broad",
      title: "Pair warning",
      family_line_en: "Brufen and Ecosprin together.",
      created_at: "2026-11-15T12:00:00+05:30",
    });
    const narrow = card({
      id: "narrow",
      title: "Brufen only",
      family_line_en: "Brufen was self-added.",
      created_at: "2026-11-15T09:00:00+05:30",
    });
    const out = dedupeCards([narrow, broad], ["Brufen", "Ecosprin"]);
    expect(out.map((c) => c.id)).toEqual(["broad"]);
  });

  it("dedupes notes with no known medicine by title, keeping the newest", () => {
    const a = card({ id: "a", title: "General reminder", created_at: "2026-11-14T10:00:00+05:30" });
    const b = card({ id: "b", title: "General reminder", created_at: "2026-11-15T10:00:00+05:30" });
    expect(dedupeCards([a, b], []).map((c) => c.id)).toEqual(["b"]);
  });

  it("ignores medicine tokens shorter than 3 letters and keeps unrelated notes", () => {
    const a = card({
      id: "a",
      title: "Thyronorm timing",
      family_line_en: "Thyronorm is due in the morning.",
      created_at: "2026-11-15T10:00:00+05:30",
    });
    const b = card({
      id: "b",
      title: "Shelcal timing",
      family_line_en: "Shelcal is due in the evening.",
      created_at: "2026-11-15T11:00:00+05:30",
    });
    const out = dedupeCards([a, b], ["Thyronorm", "Shelcal", "AB"]);
    expect(out.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("treats medicine names as whole words and escapes regex characters", () => {
    const a = card({
      id: "a",
      title: "Note",
      family_line_en: "Take care with PA+ pills listed in the log.",
      tell_doctor: "n/a",
      created_at: "2026-11-15T10:00:00+05:30",
    });
    const out = dedupeCards([a], ["PA+"]);
    expect(out).toHaveLength(1);
  });
});
