// Manicuristas Imparables «Este congreso es para ti si…» (the team, 2026-11-03), word for word: a section of its own
// between the cover and «¿Qué tienen en común…?» — its title, who it's for in a gold card and a closing line under it.
// Without its eyebrow «¿Es para mí?» and without the cover's line «Para manicuristas que llevan años en la mesa y
// quieren más.» since 2026-11-03 (the team's boceto). The page reads it from here
// (components/imparables/ImparablesPage.tsx).
export const ES_PARA_MI = {
  title: "Este congreso es para ti si…",
  items: [
    "Atiendes por tu cuenta y te cansaste de cobrar barato, trabajar sin parar y no ver la plata.",
    "Tienes el talento, pero tu negocio todavía no refleja lo que vales.",
    "Sabes que naciste para más, lleves dos o diez años en la mesa.",
  ],
  /** Under the card. */
  closing: "Si dijiste «esa soy yo», el 27 de junio es tuyo.",
};

/** The gold strip over everything, before the cover, that says what it is and who it's for at once (the team's boceto,
 * 2026-11-03; these words, as written, the same day): what goes between ** ** in bold. */
export const FRANJA = "Congreso virtual de **mentalidad, dinero y marketing** para **manicuristas**";

/** "a **b** c" → [{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]: the strip's words. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}
