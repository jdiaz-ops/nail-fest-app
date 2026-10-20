// Shapes and helpers the cuponera (nailfest.lat/cuponera) shares between the
// public page, its admin (/admin/cuponera) and the Marcolini sync.

export type ProductIconKind = "bottle" | "drop" | "tips" | "lamp" | "brush" | "kit" | "file" | "star" | "drill";
export type CuponeraProfession = "mani" | "est" | "salon" | "casa";

// ── Categories ─────────────────────────────────────────────────────────────
//
// The nine nail categories Marcolini itself uses to propose collections to
// its brands (nicheCategoryOf in its lib/shopify-categorize.ts) — same names,
// so both platforms speak the same language — each with the subcategories
// the cuponera filters by. Keys are stored in CuponeraProduct.category /
// subcategory and CuponeraCollectionMap: don't rename them.

export type CuponeraCategory = "esmaltes" | "construccion" | "acrilico" | "softgel" | "herramientas" | "cuidado" | "decoracion" | "stamping" | "kits";

export interface CuponeraSubcategory {
  key: string;
  label: string;
}

interface CategoryDef {
  key: CuponeraCategory;
  /** Full name, as Marcolini writes it. */
  label: string;
  /** Short name for the chips. */
  chip: string;
  look: { icon: ProductIconKind; color: string; tint: string };
  subcategories: (CuponeraSubcategory & { rule: RegExp; look?: { icon: ProductIconKind; color: string; tint: string } })[];
  /** Words that put a product in this category, on accent-free lowercase text. */
  rule: RegExp;
}

// Word-bounded alternation on normalizeText() output.
const words = (list: string) => new RegExp(`(?:^|\\s)(?:${list})(?:\\s|$)`);

// Checked in this order — first match wins, so the specific goes before
// the generic: a kit is a kit whatever it holds; "pincel para acrílico" is
// a tool; "rubber base" is a building gel, not a base coat; "top coat UV"
// is a top coat (only lamp words make a tool, never "uv" or "led" alone);
// a plain "gel" is a polish only when nothing else matched.
const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: "kits",
    label: "Kits y combos",
    chip: "Kits",
    look: { icon: "kit", color: "#ffc5a8", tint: "#fff3ea" },
    subcategories: [],
    rule: words("kits?|combos?|sets?|packs?|estuches?"),
  },
  {
    key: "herramientas",
    label: "Herramientas y equipos",
    chip: "Herramientas",
    look: { icon: "file", color: "#ffc5a8", tint: "#f3f1ee" },
    subcategories: [
      { key: "lamparas", label: "Lámparas", rule: words("lamparas?|lamps?|cabinas?"), look: { icon: "lamp", color: "none", tint: "#f3f1ee" } },
      { key: "tornos", label: "Tornos y fresas", rule: words("tornos?|drills?|fresas?|brocas?|bits?"), look: { icon: "drill", color: "#ffc5a8", tint: "#fff3ea" } },
      { key: "limas", label: "Limas y buffers", rule: words("limas?|buffers?|pulidor(?:es)?|files?"), look: { icon: "file", color: "#ffc5a8", tint: "#f3f1ee" } },
      { key: "pinceles", label: "Pinceles", rule: words("pincel(?:es)?|brush(?:es)?|liners?|dotting|punteador(?:es)?"), look: { icon: "brush", color: "#17181c", tint: "#e6f9f7" } },
      { key: "alicates", label: "Alicates y pushers", rule: words("alicates?|cortaunas|cortacuticulas?|tijeras?|pushers?|empujador(?:es)?|pinzas?|cutters?|espatulas?") },
    ],
    rule: words(
      "herramientas?|equipos?|lamparas?|lamps?|cabinas?|tornos?|drills?|fresas?|brocas?|limas?|buffers?|pulidor(?:es)?|pincel(?:es)?|brush(?:es)?|alicates?|cortaunas|cortacuticulas?|tijeras?|pushers?|empujador(?:es)?|pinzas?|espatulas?|dotting|punteador(?:es)?|aspiradoras?|extractor(?:es)?|organizador(?:es)?|exhibidor(?:es)?|esterilizador(?:es)?",
    ),
  },
  {
    key: "construccion",
    label: "Gel de construcción",
    chip: "Construcción",
    look: { icon: "bottle", color: "#f6e3d8", tint: "#fff3ea" },
    subcategories: [
      { key: "polygel", label: "Polygel", rule: words("poly ?gel|polygel|polig\\w*|acrygel") },
      { key: "rubber", label: "Rubber base", rule: words("rubber") },
      { key: "builder", label: "Builder gel", rule: words("builder|constructor(?:es)?|construccion|hard gel|gel duro") },
    ],
    rule: words("builder|constructor(?:es)?|construccion|poly ?gel|polygel|polig\\w*|acrygel|hard gel|gel duro|rubber"),
  },
  {
    key: "softgel",
    label: "Soft gel y tips",
    chip: "Tips",
    look: { icon: "tips", color: "#ffffff", tint: "#e6f9f7" },
    subcategories: [
      { key: "press-on", label: "Press on", rule: words("press ?on|presson|postizas?") },
      { key: "soft-gel", label: "Soft gel", rule: words("soft ?gel|softgel|acrysoft|gel ?x") },
      { key: "tips", label: "Tips", rule: words("tips?|full cover|extension(?:es)?") },
    ],
    rule: words("soft ?gel|softgel|acrysoft|tips?|press ?on|presson|gel ?x|full cover|unas postizas|postizas?|extension(?:es)?"),
  },
  {
    key: "acrilico",
    label: "Acrílico",
    chip: "Acrílico",
    look: { icon: "tips", color: "#fde8ef", tint: "#e6f9f7" },
    subcategories: [
      { key: "polvos", label: "Polvos acrílicos", rule: words("polvos?|polimeros?|powders?") },
      { key: "monomero", label: "Monómero", rule: words("monomeros?|liquidos?") },
    ],
    rule: words("acrilicos?|acrylics?|polimeros?|monomeros?"),
  },
  {
    key: "stamping",
    label: "Stamping",
    chip: "Stamping",
    look: { icon: "brush", color: "#17181c", tint: "#f3f1ee" },
    subcategories: [],
    rule: words("stamping|placas?|plates?|estampados?|sellos?|raspador(?:es)?|scrapers?"),
  },
  {
    key: "decoracion",
    label: "Decoración",
    chip: "Decoración",
    look: { icon: "star", color: "#f2b01e", tint: "#fff3ea" },
    subcategories: [
      { key: "efectos", label: "Glitter, cromos y efectos", rule: words("glitters?|escarchas?|cromos?|chrome|holo\\w*|mirror|espejo|pigmentos?|cat eye|ojo de gato|sirena|flakes|hojuelas?|aurora") },
      { key: "stickers", label: "Stickers y foil", rule: words("stickers?|calcomanias?|pegatinas?|foils?|transfers?|decals?") },
      { key: "aplicaciones", label: "Piedras y aplicaciones", rule: words("strass|cristal(?:es)?|rhinestones?|charms?|dijes?|piedras?|perlas?") },
    ],
    rule: words(
      "decoracion(?:es)?|nail art|glitters?|foils?|strass|cristal(?:es)?|rhinestones?|charms?|dijes?|stickers?|calcomanias?|pegatinas?|pigmentos?|cromos?|chrome|holo\\w*|cat eye|ojo de gato|sirena|mirror|espejo|flakes|hojuelas?|piedras?|perlas?|escarchas?|transfers?|encapsulados?",
    ),
  },
  {
    key: "cuidado",
    label: "Preparación y cuidado",
    chip: "Cuidado",
    look: { icon: "drop", color: "#f2b01e", tint: "#fdf3d6" },
    subcategories: [
      { key: "top-base", label: "Top y base coat", rule: words("top ?coat|topcoat|top|base ?coat|basecoat|base|selladores?|finish") },
      { key: "preparacion", label: "Preparación", rule: words("primers?|bond|bonder|deshidratador(?:es)?|dehydrators?|prep|cleaners?|limpiador(?:es)?|cleansers?|alcohol|antiseptic\\w*") },
      { key: "cuticulas", label: "Cutículas y removedores", rule: words("cuticulas?|cuticles?|aceites?|oils?|removedor(?:es)?|removers?|acetona|quitaesmaltes?") },
      { key: "manos", label: "Manos y pies", rule: words("cremas?|hidrat\\w*|spa|exfolia\\w*|parafinas?|serums?|pies|manos|algodon(?:es)?|toallas?|wipes") },
    ],
    rule: words(
      "cuidados?|preparacion|primers?|bond|bonder|deshidratador(?:es)?|dehydrators?|prep|cleaners?|limpiador(?:es)?|removedor(?:es)?|removers?|acetona|quitaesmaltes?|aceites?|oils?|cuticulas?|cuticles?|cremas?|hidrat\\w*|top ?coat|topcoat|top|base ?coat|basecoat|base|fortalecedor(?:es)?|tratamientos?|algodon(?:es)?|toallas?|wipes|cleansers?|antiseptic\\w*|alcohol|finish|selladores?|spa|exfolia\\w*|parafinas?|serums?",
    ),
  },
  {
    key: "esmaltes",
    label: "Esmaltes",
    chip: "Esmaltes",
    look: { icon: "bottle", color: "#f48fb1", tint: "#fde8ef" },
    subcategories: [
      { key: "semipermanente", label: "Semipermanente", rule: words("semi ?permanentes?|semipermanentes?|gel polish|color gel|shellac|geles|gel|uv") },
      { key: "tradicional", label: "Esmalte tradicional", rule: words("esmaltes?|lacas?|polish") },
    ],
    rule: words("esmaltes?|polish|semi ?permanentes?|semipermanentes?|gel polish|lacas?|color gel|shellac|esmaltado|geles|gel"),
  },
];

/** The order of the chips on the public page. */
const CHIP_ORDER: CuponeraCategory[] = ["esmaltes", "construccion", "acrilico", "softgel", "herramientas", "cuidado", "decoracion", "stamping", "kits"];

export const CUPONERA_CATEGORIES: { key: "todo" | CuponeraCategory; label: string; chip: string }[] = [
  { key: "todo", label: "Todo", chip: "Todo" },
  ...CHIP_ORDER.map((key) => {
    const def = CATEGORY_DEFS.find((d) => d.key === key)!;
    return { key, label: def.label, chip: def.chip };
  }),
];

export const CATEGORY_KEYS: CuponeraCategory[] = [...CHIP_ORDER];

export function isCategory(value: unknown): value is CuponeraCategory {
  return typeof value === "string" && (CATEGORY_KEYS as string[]).includes(value);
}

export function categoryLabel(key: CuponeraCategory | null): string {
  return CATEGORY_DEFS.find((d) => d.key === key)?.label ?? "Sin categoría";
}

export function subcategoriesOf(category: CuponeraCategory | null): CuponeraSubcategory[] {
  return (CATEGORY_DEFS.find((d) => d.key === category)?.subcategories ?? []).map(({ key, label }) => ({ key, label }));
}

export function isSubcategoryOf(category: CuponeraCategory | null, value: unknown): value is string {
  return typeof value === "string" && subcategoriesOf(category).some((s) => s.key === value);
}

export function subcategoryLabel(category: CuponeraCategory | null, key: string | null): string | null {
  return subcategoriesOf(category).find((s) => s.key === key)?.label ?? null;
}

/** Marcolini's category name ("Gel de construcción") → our key. */
export function categoryFromMarcolini(name: string | null | undefined): CuponeraCategory | null {
  if (!name) return null;
  const wanted = normalizeText(name);
  return CATEGORY_DEFS.find((d) => normalizeText(d.label) === wanted)?.key ?? null;
}

// The drawing and colors a product without a photo gets.
export function lookFor(category: CuponeraCategory | null, subcategory: string | null): { icon: ProductIconKind; color: string; tint: string } {
  const def = CATEGORY_DEFS.find((d) => d.key === category);
  return def?.subcategories.find((s) => s.key === subcategory)?.look ?? def?.look ?? { icon: "kit", color: "#ffc5a8", tint: "#fff3ea" };
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function categoryOfText(text: string): CuponeraCategory | null {
  const haystack = normalizeText(text);
  if (!haystack) return null;
  return CATEGORY_DEFS.find((d) => d.rule.test(haystack))?.key ?? null;
}

function subcategoryOfText(category: CuponeraCategory, text: string): string | null {
  const haystack = normalizeText(text);
  if (!haystack) return null;
  return CATEGORY_DEFS.find((d) => d.key === category)?.subcategories.find((s) => s.rule.test(haystack))?.key ?? null;
}

type ProductWords = { name: string; line?: string | null; collections?: string[]; sourceCategory?: string | null };

// Evidence in order of trust: the product's name, its line, the brand's
// collections, the store's category.
function wordsOf(input: ProductWords): string[] {
  return [input.name, input.line ?? "", ...(input.collections ?? []), input.sourceCategory ?? ""];
}

/** The subcategory a product's own words give inside a category — also one
 * the admin or a collection gave it without a subcategory. */
export function subcategoryWithin(category: CuponeraCategory, input: ProductWords): string | null {
  for (const text of wordsOf(input)) {
    const subcategory = subcategoryOfText(category, text);
    if (subcategory) return subcategory;
  }
  return null;
}

/** The sync's guess of a product's category and subcategory: its words (see
 * wordsOf), and last Marcolini's own nicheCategory. null = no clue: the
 * product only shows under "Todo" until the admin (or a collection mapping)
 * says otherwise. */
export function classifyProduct(input: ProductWords & { nicheCategory?: string | null }): { category: CuponeraCategory | null; subcategory: string | null } {
  let category: CuponeraCategory | null = null;
  for (const text of wordsOf(input)) {
    category = categoryOfText(text);
    if (category) break;
  }
  category ??= categoryFromMarcolini(input.nicheCategory);
  if (!category) return { category: null, subcategory: null };
  return { category, subcategory: subcategoryWithin(category, input) };
}

// ── Collections (the unifier) ──────────────────────────────────────────────

const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "para", "en", "con", "por", "a"]);

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("es") && /[lrndz]$/.test(word.slice(0, -2))) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** One key for the same collection written differently across brands:
 * "Esmaltes Semipermanentes", "esmalte semipermanente", "Semipermanente
 * esmaltes" → "esmalte semipermanente". */
export function collectionKey(name: string): string {
  return normalizeText(name)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
    .sort()
    .join(" ");
}

// ── Colors and sizes ───────────────────────────────────────────────────────

/** Marcolini's fixed color families (its lib/color-families.ts): its AI
 * picks one from each product photo, so the same names mean the same thing
 * across every brand. In the filter's order, each with its swatch. */
export const COLOR_FAMILIES: { name: string; swatch: string }[] = [
  { name: "Nudes", swatch: "#d9b99b" },
  { name: "Rosados", swatch: "#f2a7c3" },
  { name: "Rojos", swatch: "#c8102e" },
  { name: "Corales y naranjas", swatch: "#ff7f50" },
  { name: "Amarillos", swatch: "#f2c94c" },
  { name: "Verdes", swatch: "#3c9d5d" },
  { name: "Azules", swatch: "#2f6fd6" },
  { name: "Morados", swatch: "#8e5bd0" },
  { name: "Cafés", swatch: "#7b4a2e" },
  { name: "Grises", swatch: "#9a9a9a" },
  { name: "Negros", swatch: "#111111" },
  { name: "Blancos", swatch: "#ffffff" },
  { name: "Glitter", swatch: "linear-gradient(135deg, #f7e7a1, #c0c0c0 45%, #f5b5d4)" },
  { name: "Transparentes", swatch: "repeating-conic-gradient(#e5e5e5 0 25%, #ffffff 0 50%) 50% / 6px 6px" },
  { name: "Multicolor", swatch: "conic-gradient(#e63946, #f4a261, #e9c46a, #2a9d8f, #457b9d, #8e5bd0, #e63946)" },
];

export function isColorFamily(value: unknown): value is string {
  return typeof value === "string" && COLOR_FAMILIES.some((f) => f.name === value);
}

export function colorSwatch(family: string | null): string | null {
  return COLOR_FAMILIES.find((f) => f.name === family)?.swatch ?? null;
}

const UNIT_NAMES: [RegExp, string][] = [
  [/^(ml|mililitros?|cc)$/, "ml"],
  [/^(g|gr|grs|gramos?)$/, "g"],
  [/^(kg|kilos?|kilogramos?)$/, "kg"],
  [/^(oz|onzas?)$/, "oz"],
  [/^(l|lt|litros?)$/, "l"],
  [/^(und|unds|unidad|unidades|uds|pzs|piezas?)$/, "und"],
];

function normalizeSize(amount: string, unit: string): string | null {
  const name = UNIT_NAMES.find(([re]) => re.test(unit.toLowerCase()))?.[1];
  if (!name) return null;
  const value = Number(amount.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${String(value).replace(".", ",")} ${name}`;
}

/** "15 ml", "30 g", "500 und" — from Marcolini's size attribute when there
 * is one, or from the product name ("Gel 15ML", "Tips x500"). */
export function sizeOf(name: string, attribute?: string | null): string | null {
  for (const text of [attribute ?? "", name]) {
    const measure = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|cc|grs?|g|gramos?|kg|kilos?|oz|onzas?|lt|litros?|l|unds?|unidad(?:es)?|uds|pzs|piezas?)\b/i);
    if (measure) {
      const size = normalizeSize(measure[1]!, measure[2]!);
      if (size) return size;
    }
    const count = text.match(/\bx\s?(\d{2,5})\b/i);
    if (count) return `${Number(count[1])} und`;
  }
  return null;
}

/** Categories whose products come in shades: a polish, a builder gel, an
 * acrylic powder or a glitter has "tonos"; a lamp has "colores". */
export const SHADE_CATEGORIES: ReadonlySet<CuponeraCategory> = new Set<CuponeraCategory>(["esmaltes", "construccion", "acrilico", "decoracion"]);

// What a store product's own variants are, from its option names
// (Marcolini's optionNames: "Color", "Tamaño"…).
const VARIANT_NOUNS: [RegExp, string][] = [
  [/^(color|colores|colour|tono|tonos|shade|shades)$/, "colores"],
  [/^(tamano|tamanos|size|talla|presentacion|contenido|volumen)$/, "tamaños"],
  [/^(aroma|aromas|fragancia|olor|scent)$/, "aromas"],
  [/^(diseno|disenos|design|modelo|modelos|forma|formas)$/, "diseños"],
];

/** "24 tonos" (a polish), "2 colores" (a lamp), "3 tamaños"; "5 opciones"
 * when they vary in more than one way (12 colors × 2 sizes aren't 24
 * tones); null for fewer than two. */
export function variantsLabelOf(count: number, optionNames: string[], category: CuponeraCategory | null = null): string | null {
  if (count < 2) return null;
  const names = optionNames.map(normalizeText).filter(Boolean);
  let noun = names.length === 1 ? VARIANT_NOUNS.find(([re]) => re.test(names[0]!))?.[1] : undefined;
  if (noun === "colores" && category && SHADE_CATEGORIES.has(category)) noun = "tonos";
  return `${count} ${noun ?? "opciones"}`;
}

// ── What the public page renders ───────────────────────────────────────────

export interface CuponeraProduct {
  id: string;
  brand: string;
  name: string;
  /** Price with Nail Fest's code, whole COP. */
  price: number;
  /** Store price before the code, whole COP. */
  before: number;
  /** Variants cost different: both prices are the cheapest one ("Desde"). */
  priceFrom: boolean;
  /** The brand's code for Nail Fest. */
  code: string;
  /** Product photo; null = the drawn icon (sample data, or no photo). */
  imageUrl: string | null;
  icon: ProductIconKind;
  /** Product color drawn inside the icon. */
  color: string;
  /** Photo background. */
  tint: string;
  category: CuponeraCategory | null;
  subcategory: string | null;
  /** Empty = for every profession. */
  professions: CuponeraProfession[];
  /** Store link carrying Nail Fest's code; null in the sample preview. */
  url: string | null;
  colorFamily: string | null;
  size: string | null;
  /** The line it belongs to ("Gel Polish Rosados") and what it is in it
   * ("Princesa") — products of one line show as a single card. */
  line: string | null;
  variant: string | null;
  /** Shades/options of the product itself, when it has variants. */
  variantCount: number;
  /** "24 tonos", "3 tamaños" — null without variants. */
  variantsLabel: string | null;
  rating: { average: number; count: number } | null;
  /** Only when the store tracks stock. */
  unitsLeft: number | null;
  /** Units bought with Nail Fest's code in the last 90 days. */
  soldWithCode: number;
  /** Short plain text, only for the search box. */
  description: string | null;
}

export interface CuponeraCoupon {
  id: string;
  brand: string;
  initial: string;
  logoUrl: string | null;
  tone: "pink" | "teal" | "peach";
  title: string;
  code: string;
  /** The first two show on the card; all of them in the sheet. */
  conditions: string[];
  exclusive: boolean;
  url: string | null;
}

export interface CuponeraDesignItem {
  name: string;
  brand: string;
  price: number;
  before: number;
  color: string;
  url: string | null;
}

export interface CuponeraDesign {
  title: string;
  headline: string;
  credit: string;
  items: CuponeraDesignItem[];
}

export interface CuponeraList {
  id: string;
  title: string;
  author: string;
  count: number;
  swatches: [string, string, string, string];
}

export const CUPONERA_PROFESSIONS: { key: CuponeraProfession; label: string; plural: string }[] = [
  { key: "mani", label: "Manicurista", plural: "manicuristas" },
  { key: "est", label: "Estudiante", plural: "estudiantes" },
  { key: "salon", label: "Salón", plural: "salones" },
  { key: "casa", label: "Me pinto en casa", plural: "las que se pintan en casa" },
];

export const PROFESSION_KEYS = CUPONERA_PROFESSIONS.map((p) => p.key);

export function isProfession(value: unknown): value is CuponeraProfession {
  return typeof value === "string" && (PROFESSION_KEYS as string[]).includes(value);
}

export function priceWithCode(price: number, discountPercent: number): number {
  if (!(discountPercent > 0)) return price;
  return Math.round(price * (1 - discountPercent / 100));
}

export function formatCop(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

export function discountPercent(price: number, before: number): number {
  return before > 0 ? Math.round((1 - price / before) * 100) : 0;
}

/** "15 %" with up to two decimals, as the brand set it ("12,5 %"). */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}

/** "4,8" — one decimal, Colombian comma. */
export function formatRating(value: number): string {
  return value.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
