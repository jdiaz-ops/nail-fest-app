// What the library's search understands (2026-10-25: "búsqueda que
// entiende"): the words people write that say nothing about what they
// look for, and the different ways of writing the same thing in nails —
// "poligel" is polygel, "esmaltado permanente" is semipermanente. All of
// it accent-free and lowercase, the way normalizeText leaves a text. No
// database here: the admin's own search uses it too.

/** Words that never keep a result out ("cómo hacer uñas francesas" looks for "francesas"). */
export const SEARCH_STOPWORDS = new Set([
  "a",
  "al",
  "como",
  "con",
  // The question words: «cuánto cobrar» looks for «cobrar».
  "cual",
  "cuales",
  "cuando",
  "cuanta",
  "cuantas",
  "cuanto",
  "cuantos",
  "de",
  "del",
  "donde",
  "el",
  "en",
  "es",
  "hacer",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "mis",
  "nail",
  "nails",
  "o",
  "para",
  "paso",
  "por",
  "que",
  "quiero",
  "se",
  "su",
  "sus",
  "tu",
  "tus",
  "tutorial",
  "un",
  // "uña", "uñas" (and the article "una"): in a nails library they say nothing.
  "una",
  "unas",
  "uno",
  "unos",
  "video",
  "videos",
  "y",
]);

/** Each line, the ways of writing one thing; searching for any finds them all. */
export const SEARCH_SYNONYMS: readonly string[][] = [
  ["polygel", "poligel", "poly gel", "poli gel", "polygell", "acrygel", "acrigel"],
  ["acrilico", "acrilica", "acrilicos", "acrilicas", "acrylic", "acrilic"],
  ["semipermanente", "semi permanente", "esmaltado permanente", "esmalte permanente", "esmaltado semipermanente", "gelish", "shellac", "gel polish", "esmalte en gel"],
  ["francesa", "frances", "french", "manicura francesa"],
  ["degradado", "ombre", "baby boomer", "babyboomer"],
  ["cromo", "chrome", "cromado", "efecto espejo"],
  ["esculpidas", "esculpida", "esculpir", "extension", "extensiones"],
  ["retiro", "retirar", "quitar", "remover", "remocion"],
  ["manicura rusa", "rusa", "manicura combinada", "combinada", "manicura en seco"],
  ["hongos", "hongo", "onicomicosis"],
  ["precio", "precios", "cobrar", "tarifa", "tarifas"],
  ["nail art", "diseno", "disenos", "decoracion", "decoraciones", "decorado"],
  ["press on", "presson", "postizas", "unas postizas"],
  ["dip", "dip powder", "inmersion", "polvo de inmersion"],
  ["rubber", "rubber base", "base rubber", "base niveladora", "nivelacion"],
  ["builder", "builder gel", "gel constructor"],
  ["pedicura", "pedicure"],
  ["cuticula", "cuticulas", "cuticle"],
  ["lampara", "lamparas", "cabina"],
  ["esterilizacion", "esterilizar", "desinfeccion", "desinfectar"],
  ["navidad", "navideno", "navidena", "navidenos", "navidenas", "christmas"],
  ["san valentin", "valentin", "valentine"],
  ["almendra", "almond"],
  ["cuadrada", "square"],
  ["coffin", "bailarina", "ballerina"],
];

const GROUP_OF = new Map<string, readonly string[]>();
for (const group of SEARCH_SYNONYMS) for (const variant of group) GROUP_OF.set(variant, group);

/** A word or phrase and the others that mean the same; just itself when there are none. */
export function synonymsOf(term: string): readonly string[] {
  return GROUP_OF.get(term) ?? [term];
}

/** The phrases of more than one word, the longest first, to read them as one. */
export const SEARCH_PHRASES: readonly string[][] = [...GROUP_OF.keys()]
  .filter((variant) => variant.includes(" "))
  .map((variant) => variant.split(" "))
  .sort((a, b) => b.length - a.length);
