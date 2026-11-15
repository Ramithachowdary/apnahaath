import type { DecisionCard } from "./types";

/**
 * Collapse repeated safety notes about the same medicines (e.g. several Brufen + Ecosprin warnings)
 * into the newest one. The key is the set of the household's medicine names mentioned in the note;
 * notes that mention no known medicine are deduped by title. An older note whose medicines are all covered
 * by a newer note is dropped too.
 */
export function dedupeCards(cards: DecisionCard[], medicineNames: string[]): DecisionCard[] {
  const names = [...new Set(medicineNames.map((n) => n.split(/\s+/)[0].toLowerCase()).filter((n) => n.length > 2))];
  const newestFirst = [...cards].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const seen = new Set<string>();
  const keptSets: string[][] = [];
  const out: DecisionCard[] = [];
  for (const c of newestFirst) {
    const text = `${c.title} ${c.family_line_en} ${c.tell_doctor}`.toLowerCase();
    const hits = names.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)).sort();
    const key = hits.length ? `meds:${hits.join("+")}` : `title:${c.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    // an older note about a subset of the same medicines is covered by a newer, broader one
    if (hits.length && keptSets.some((k) => hits.every((h) => k.includes(h)))) continue;
    seen.add(key);
    if (hits.length) keptSets.push(hits);
    out.push(c);
  }
  return out;
}
