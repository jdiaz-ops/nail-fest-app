// A live typo detector for the registration form's email field — "¿hay
// posibilidad de tener un detector de correos mal redactados?" flags a
// likely fat-fingered domain WHILE someone types (gmial.com, hotmial.com,
// yahooo.com, gmail.con…) without ever blocking the submit — it's a
// suggestion, never a hard validation rule, since there's no way to know
// a domain is wrong for certain (a real, unusual domain always exists).
// This is the proactive half of "detectar correos mal escritos"; the
// reactive half (surfacing REAL bounces after the fact) is the
// emailStatus filter on IssuedTicketsTable.tsx.

// Deliberately small and specific to popular free/webmail providers, not
// an attempt at an exhaustive domain list (there's no such thing) — the
// same scope classic mailcheck-style detectors use. A real work/business
// domain (a salon's own site, nailfest.co) is never close enough in edit
// distance to anything here to get flagged.
const POPULAR_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.es",
  "hotmail.es",
  "outlook.es",
  "icloud.com",
  "live.com",
  "aol.com",
  "protonmail.com",
  "msn.com",
];

/** Same plain edit-distance DP as cityMatch.ts's own levenshtein() —
 * duplicated rather than imported/exported since these two are
 * conceptually unrelated (city names vs. email domains) and small enough
 * that sharing one implementation isn't worth coupling the two modules. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! : 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
    }
    prev = curr;
  }
  return prev[n]!;
}

/**
 * Returns a corrected email ("juan@gmial.com" -> "juan@gmail.com") when
 * the domain is a close-but-not-exact match of a popular provider, or
 * null when there's nothing worth suggesting (domain already known, too
 * different from anything popular to guess, or the input isn't even
 * shaped like an email yet).
 */
export function suggestEmailCorrection(rawEmail: string): string | null {
  const trimmed = rawEmail.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at === -1 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  if (domain.length < 4) return null; // too short to meaningfully compare yet
  if (POPULAR_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDist = Infinity;
  for (const d of POPULAR_DOMAINS) {
    if (Math.abs(d.length - domain.length) > 3) continue; // cheap filter first
    const dist = levenshtein(domain, d);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  // Tolerate up to 2 edits — enough for "gmial"/"gmai.com"/"gmail.con",
  // not so loose it "corrects" a genuinely different short domain.
  if (best && bestDist > 0 && bestDist <= 2) {
    return trimmed.slice(0, at + 1) + best;
  }
  return null;
}
