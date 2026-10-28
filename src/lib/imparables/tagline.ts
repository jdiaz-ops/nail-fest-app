// The event's tagline (Event.subtitle: sanitized HTML, one <p> per line)
// is read counted from the end — see .imp-tag in globals.css: the last
// paragraph is the line under the headline, the one before it the
// headline, and a third one before them the pillars («Mentalidad · Dinero
// · Marketing»). Since 2026-10-28 the pillars are told under the group
// photo instead, so they come apart from the rest here; whatever else the
// tagline holds stays where it was, untouched.
const PARAGRAPH = /<p\b[^>]*>[\s\S]*?<\/p>/g;

export function splitTagline(html: string): { pillars: string | null; tagline: string } {
  const paragraphs = [...html.matchAll(PARAGRAPH)];
  const pillars = paragraphs.length >= 3 ? paragraphs[paragraphs.length - 3] : undefined;
  if (!pillars || pillars.index === undefined) return { pillars: null, tagline: html };
  return {
    pillars: pillars[0],
    tagline: html.slice(0, pillars.index) + html.slice(pillars.index + pillars[0].length),
  };
}
