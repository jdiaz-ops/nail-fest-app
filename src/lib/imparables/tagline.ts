// The event's tagline (Event.subtitle: sanitized HTML, one <p> per line)
// is read counted from the end: the last paragraph is the cover's line, the
// one before it the headline, and a third one before them the pillars
// («Mentalidad · Dinero · Marketing»). The pillars are told under the group
// photo (2026-10-28), and the headline is no longer on the cover at all —
// it stays in the tagline, so bringing it back is only a matter of showing
// it again.
const PARAGRAPH = /<p\b[^>]*>[\s\S]*?<\/p>/g;

export function splitTagline(html: string): { pillars: string | null; headline: string | null; line: string } {
  const paragraphs = [...html.matchAll(PARAGRAPH)].map((m) => m[0]);
  const n = paragraphs.length;
  if (n === 0) return { pillars: null, headline: null, line: html };
  return {
    pillars: n >= 3 ? paragraphs[n - 3]! : null,
    headline: n >= 2 ? paragraphs[n - 2]! : null,
    line: paragraphs[n - 1]!,
  };
}
