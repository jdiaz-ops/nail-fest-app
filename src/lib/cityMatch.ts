import { COLOMBIA_CITIES, type ColombiaCity } from "./colombiaCities";

// Shared by CityAutocomplete.tsx (the forward fix — typeahead search as
// the admin/registrant types) and the city-cleanup admin tool (the
// backward fix — matching whatever free text already got saved in
// Person.city against the same canonical list). One normalize function,
// one dataset, so "what counts as a match" never drifts between the two.

/** lowercase, strip accents, trim, collapse whitespace — "Armenia Q." and
 * "ARMENIA   Q" both reduce to "armenia q", which is what makes the
 * prefix-match heuristic below actually catch real-world typos instead of
 * only byte-identical strings. */
export function normalizeCityString(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** A value that's mostly digits — a cédula number or a DANE code typed
 * (or pasted from the wrong spreadsheet column) into the city field, not
 * a city at all. Never worth fuzzy-matching against real city names —
 * flagged separately so the cleanup tool can say so plainly instead of
 * showing a nonsense "best guess". */
export function looksLikeNotACity(raw: string): boolean {
  const digits = (raw.match(/\d/g) ?? []).length;
  return digits > 0 && digits / raw.trim().length >= 0.5;
}

// Case-insensitive lookup indexes, built once at module load — this list
// is static (a code-shipped dataset, not DB-driven), so there's no
// staleness risk in building these eagerly.
const byNormalizedLabel = new Map<string, ColombiaCity>();
const byNormalizedCityName = new Map<string, ColombiaCity[]>(); // one bare city name can map to several departments
for (const c of COLOMBIA_CITIES) {
  byNormalizedLabel.set(normalizeCityString(c.label), c);
  const key = normalizeCityString(c.city);
  const list = byNormalizedCityName.get(key) ?? [];
  list.push(c);
  byNormalizedCityName.set(key, list);
}

/** Exact match only — what the live autocomplete (CityAutocomplete.tsx)
 * validates a submitted value against server-side, so a request that
 * bypasses the UI (a bot, a modified request) can't sneak in free text. */
export function isKnownCityLabel(label: string): boolean {
  return byNormalizedLabel.has(normalizeCityString(label));
}

export interface CityMatchResult {
  /** best single match, when unambiguous — null if there's no confident
   * single answer (either nothing found, or more than one candidate tied
   * for best and neither dataset nor the raw text disambiguates them). */
  match: ColombiaCity | null;
  confidence: "exact" | "prefix" | "fuzzy" | "none";
  /** every candidate that's equally plausible — length > 1 means `match`
   * is null and the admin needs to pick manually (e.g. raw "armenia"
   * alone, which is a real prefix of BOTH Armenia, Antioquia and
   * Armenia, Quindío, with nothing in the raw text to break the tie). */
  candidates: ColombiaCity[];
  notACity: boolean;
}

const LEV_CACHE_LIMIT = 40; // canonical city names are short; no need to compare against all 1103 at full cost

/** Classic edit distance — insert/delete/substitute, each cost 1. Plain
 * O(n*m) DP; city names here are short (a handful to ~20 chars) so this
 * is cheap even run against the whole list for every distinct raw value. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      // Every index below is within the arrays' known bounds by loop
      // construction (prev/curr are always filled left-to-right up to the
      // current i/j) — noUncheckedIndexedAccess can't see that, hence `!`.
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! : 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
    }
    prev = curr;
  }
  return prev[n]!;
}

/** How much edit distance to tolerate for a string of this length — a
 * fixed threshold would be too loose for short names ("Cali" vs "Cañí"
 * would wrongly match at distance 2) and too strict for long ones ("San
 * Juan Nepomuceno" with one dropped word should still match). Roughly
 * "1 typo per 6 characters, at least 1". */
function fuzzyThreshold(len: number): number {
  return Math.max(1, Math.floor(len / 6));
}

/**
 * Best-effort match for one raw, already-saved Person.city value against
 * the canonical list — used by the city-cleanup admin tool to propose
 * merges. Never silently picks a wrong city when there's real ambiguity;
 * that's what `candidates` is for (backward solution's whole point is a
 * reviewed preview, not a silent auto-merge).
 */
export function matchCity(raw: string): CityMatchResult {
  const trimmed = raw.trim();
  if (!trimmed) return { match: null, confidence: "none", candidates: [], notACity: false };
  if (looksLikeNotACity(trimmed)) return { match: null, confidence: "none", candidates: [], notACity: true };

  const normalized = normalizeCityString(trimmed);

  // 1) Exact match against the full label (already-disambiguated values,
  // e.g. someone typed "Armenia, Quindío" verbatim) or the bare city name
  // (the common case) when it's unambiguous.
  const exactLabel = byNormalizedLabel.get(normalized);
  if (exactLabel) return { match: exactLabel, confidence: "exact", candidates: [exactLabel], notACity: false };
  const exactByName = byNormalizedCityName.get(normalized);
  if (exactByName?.length === 1) {
    return { match: exactByName[0]!, confidence: "exact", candidates: exactByName, notACity: false };
  }
  if (exactByName && exactByName.length > 1) {
    // Real ambiguity in the raw data itself (e.g. saved value is just
    // "Armenia", no department) — every real screenshot case this
    // feature was built from ("Armenia Q"/"Armenia Quindio") has MORE
    // text than the bare name, so this exact-but-ambiguous branch is
    // separate from the prefix-based disambiguation in step 2 below.
    return { match: null, confidence: "exact", candidates: exactByName, notACity: false };
  }

  // 2) Prefix match — "Armenia Q" / "Armenia Quindio" / "Armenia Quindío"
  // all start with "armenia". If the raw text itself contains enough of
  // the department name to disambiguate (e.g. "quindio" appears in the
  // raw value), prefer that candidate; otherwise fall through to
  // candidates (ambiguous) only when more than one department's city
  // shares the prefix.
  const prefixMatches: [string, ColombiaCity[]][] = [...byNormalizedCityName.entries()].filter(
    ([name]) => name.length >= 4 && normalized.startsWith(name)
  );
  if (prefixMatches.length > 0) {
    // Longest matching city name wins among prefix matches (e.g. "san
    // juan de urabá" beats "san juan" if both were somehow prefixes).
    prefixMatches.sort((a, b) => b[0].length - a[0].length);
    const [, candidates] = prefixMatches[0]!;
    if (candidates.length === 1) {
      return { match: candidates[0]!, confidence: "prefix", candidates, notACity: false };
    }
    const byDept = candidates.filter((c) => normalized.includes(normalizeCityString(c.department)));
    if (byDept.length === 1) {
      return { match: byDept[0]!, confidence: "prefix", candidates: byDept, notACity: false };
    }
    return { match: null, confidence: "prefix", candidates, notACity: false };
  }

  // 3) Fuzzy edit-distance fallback — real misspellings that don't share
  // a clean prefix ("Bogota" vs "Bogotá" is actually caught by
  // normalization above already; this catches things like "Medellin" ->
  // no, also caught by normalization — this tier is for genuine typos,
  // e.g. "Bucaramnga").
  let best: { city: ColombiaCity; dist: number }[] = [];
  let bestDist = Infinity;
  for (const c of COLOMBIA_CITIES) {
    const name = normalizeCityString(c.city);
    // Skip wildly different lengths up front — cheap filter before the
    // full O(n*m) distance computation.
    if (Math.abs(name.length - normalized.length) > 6) continue;
    const dist = levenshtein(normalized, name);
    if (dist > fuzzyThreshold(Math.max(name.length, normalized.length))) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = [{ city: c, dist }];
    } else if (dist === bestDist) {
      best.push({ city: c, dist });
      if (best.length > LEV_CACHE_LIMIT) break; // pathological input, bail
    }
  }
  if (best.length === 1) {
    return { match: best[0]!.city, confidence: "fuzzy", candidates: [best[0]!.city], notACity: false };
  }
  if (best.length > 1) {
    return { match: null, confidence: "fuzzy", candidates: best.map((b) => b.city), notACity: false };
  }

  return { match: null, confidence: "none", candidates: [], notACity: false };
}
