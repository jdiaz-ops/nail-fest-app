// The event's tagline (Event.subtitle: sanitized HTML, one <p> per line)
// is read counted from the end: the last paragraph is the cover's line, the
// one before it the headline, and a third one before them the pillars
// («Mentalidad · Dinero · Marketing»). The pillars are told under the group
// photo (2026-10-28); the headline, off the cover for a while, is back over
// the line since 2026-10-31 («Empezaron desde abajo, con tus mismos
// miedos. Hoy tienen el negocio que sueñas.»).
const PARAGRAPH = /<p\b[^>]*>[\s\S]*?<\/p>/g;

/** On a computer, the headline a sentence a line (2026-11-02): «Empezaron desde abajo, con tus mismos miedos.» over
 * «Hoy tienen el negocio que sueñas.» — a <br class="imp-tag-br"> after each sentence's end that another follows, in
 * its words only, never inside a tag. Hidden on a phone or a tablet, where the sentences run on (globals.css). */
export function sentencePerLine(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(/([.!?…])(\s+)(?=[¿¡«"“]?[A-ZÁÉÍÓÚÜÑ])/g, '$1<br class="imp-tag-br">$2')))
    .join("");
}

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
