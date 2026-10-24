import { normalizeText } from "@/lib/cuponera/shared";

// The library's search: every word typed has to be somewhere in the item
// (accents and capitals don't matter); where it is decides the order — a
// word in the title beats the same word in the description, and a word
// that starts a word ("pol" in "polygel") beats one buried inside another.

export interface SearchField {
  text: string | null | undefined;
  weight: number;
}

/** 0 = some word isn't anywhere; otherwise the higher, the better. */
export function scoreFields(fields: SearchField[], words: string[]): number {
  if (words.length === 0) return 0;
  const haystacks = fields.map((f) => ({ text: ` ${normalizeText(f.text ?? "")} `, weight: f.weight }));
  let total = 0;
  for (const word of words) {
    let best = 0;
    for (const h of haystacks) {
      if (h.text.includes(` ${word}`)) best = Math.max(best, h.weight * 2);
      else if (h.text.includes(word)) best = Math.max(best, h.weight);
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

/** The items every word matches, best first; ties keep their order. */
export function rankBy<T>(items: T[], words: string[], fieldsOf: (item: T) => SearchField[]): T[] {
  return items
    .map((item, index) => ({ item, index, score: scoreFields(fieldsOf(item), words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
