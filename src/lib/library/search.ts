import { normalizeText } from "@/lib/cuponera/shared";
import { synonymsOf } from "./searchWords";

// The library's search: every word typed has to be somewhere in the item
// (accents and capitals don't matter); where it is decides the order — a
// word in the title beats the same word in the description, and a word
// that starts a word ("pol" in "polygel") beats one buried inside another.
// Since 2026-10-25 it also understands (lib/library/searchWords.ts): the
// other ways of writing the same thing ("poligel"), plurals and a/o
// endings ("acrílicas" finds "acrílico") and a letter off ("semipermanete");
// queryWords already leaves out the words that say nothing.

export interface SearchField {
  text: string | null | undefined;
  weight: number;
}

/** "acrílicas" → "acrilic", "francés" → "franc": a word without its plural
 * and its a/o/e, to find the others that start the same. */
export function stemOf(word: string): string {
  let stem = word;
  if (stem.length > 4 && /[^aeiou]es$/.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith("s")) stem = stem.slice(0, -1);
  if (stem.length > 4 && /[aeo]$/.test(stem)) stem = stem.slice(0, -1);
  return stem;
}

/** Letters to change, add or take out to go from one word to the other —
 * counted only up to `max`: anything further is max + 1. */
function distanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      least = Math.min(least, row[j]!);
    }
    if (least > max) return max + 1;
    previous = row;
  }
  return previous[b.length]!;
}

interface Haystack {
  /** Normalized, between spaces. */
  text: string;
  /** Its words of four letters or more, for the typos. */
  words: string[];
  weight: number;
}

/** How well a way of writing a word is in a field: as a word's start, inside
 * a word, by its stem, or — the word as typed — with a letter off. */
function matchWeight(alternative: string, haystack: Haystack, typed: boolean): number {
  if (haystack.text.includes(` ${alternative}`)) return haystack.weight * 2;
  if (haystack.text.includes(alternative)) return haystack.weight;
  if (alternative.includes(" ")) return 0;
  const stem = stemOf(alternative);
  if (stem.length >= 4 && haystack.text.includes(` ${stem}`)) return haystack.weight * 1.5;
  if (typed && alternative.length >= 5) {
    const max = alternative.length >= 8 ? 2 : 1;
    if (haystack.words.some((w) => distanceWithin(w, alternative, max) <= max)) return haystack.weight * 0.75;
  }
  return 0;
}

/** 0 = some word isn't anywhere; otherwise the higher, the better. */
export function scoreFields(fields: SearchField[], words: string[]): number {
  if (words.length === 0) return 0;
  const haystacks: Haystack[] = fields.map((f) => {
    const text = normalizeText(f.text ?? "");
    return { text: ` ${text} `, words: text.split(" ").filter((w) => w.length >= 4), weight: f.weight };
  });
  let total = 0;
  for (const word of words) {
    let best = 0;
    for (const alternative of synonymsOf(word)) {
      for (const haystack of haystacks) best = Math.max(best, matchWeight(alternative, haystack, alternative === word));
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

/** When nothing has every word: the ones that have at least half of them,
 * the most words first. */
export function rankLoosely<T>(items: T[], words: string[], fieldsOf: (item: T) => SearchField[]): T[] {
  if (words.length < 2) return [];
  const needed = Math.ceil(words.length / 2);
  return items
    .map((item, index) => {
      const fields = fieldsOf(item);
      const scores = words.map((word) => scoreFields(fields, [word]));
      return { item, index, matched: scores.filter((s) => s > 0).length, score: scores.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.matched >= needed)
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
