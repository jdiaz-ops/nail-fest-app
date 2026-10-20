// Shapes and helpers the cuponera (nailfest.lat/cuponera) shares between the
// public page, its admin (/admin/cuponera) and the Marcolini sync.

export type ProductIconKind = "bottle" | "drop" | "tips" | "lamp" | "brush" | "kit" | "file" | "star" | "drill";
export type CuponeraCategory = "geles" | "acrilico" | "lamparas" | "herramientas" | "cuidado" | "nailart";
export type CuponeraProfession = "mani" | "est" | "salon" | "casa";

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
  /** Empty = for every profession. */
  professions: CuponeraProfession[];
  /** Store link carrying Nail Fest's code; null in the sample preview. */
  url: string | null;
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

export const CUPONERA_CATEGORIES: { key: "todo" | CuponeraCategory; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "geles", label: "Geles" },
  { key: "acrilico", label: "Acrílico" },
  { key: "lamparas", label: "Lámparas" },
  { key: "herramientas", label: "Herramientas" },
  { key: "cuidado", label: "Cuidado" },
  { key: "nailart", label: "Nail art" },
];

export const CATEGORY_KEYS = CUPONERA_CATEGORIES.map((c) => c.key).filter((k): k is CuponeraCategory => k !== "todo");

export const CUPONERA_PROFESSIONS: { key: CuponeraProfession; label: string; plural: string }[] = [
  { key: "mani", label: "Manicurista", plural: "manicuristas" },
  { key: "est", label: "Estudiante", plural: "estudiantes" },
  { key: "salon", label: "Salón", plural: "salones" },
  { key: "casa", label: "Me pinto en casa", plural: "las que se pintan en casa" },
];

export const PROFESSION_KEYS = CUPONERA_PROFESSIONS.map((p) => p.key);

export function isCategory(value: unknown): value is CuponeraCategory {
  return typeof value === "string" && (CATEGORY_KEYS as string[]).includes(value);
}

export function isProfession(value: unknown): value is CuponeraProfession {
  return typeof value === "string" && (PROFESSION_KEYS as string[]).includes(value);
}

// The drawing and colors a product without a photo gets, by category.
export const CATEGORY_LOOK: Record<CuponeraCategory | "otro", { icon: ProductIconKind; color: string; tint: string }> = {
  geles: { icon: "bottle", color: "#f48fb1", tint: "#fde8ef" },
  acrilico: { icon: "tips", color: "#ffffff", tint: "#e6f9f7" },
  lamparas: { icon: "lamp", color: "none", tint: "#f3f1ee" },
  herramientas: { icon: "file", color: "#ffc5a8", tint: "#f3f1ee" },
  cuidado: { icon: "drop", color: "#f2b01e", tint: "#fdf3d6" },
  nailart: { icon: "star", color: "#f2b01e", tint: "#fff3ea" },
  otro: { icon: "kit", color: "#ffc5a8", tint: "#fff3ea" },
};

export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// First match wins, so the order matters: "Removedor de cutículas" is care,
// not a tool; "Pincel liner para nail art" is nail art, not a tool; "Top
// coat UV" is a gel, never a lamp (only "lámpara"/"cabina" make a lamp).
const CATEGORY_RULES: [CuponeraCategory, RegExp][] = [
  ["lamparas", /lampara|cabina/],
  ["cuidado", /aceite|cuticul|crema|removedor|quitaesmalte|exfolia|hidrata|parafina|serum|\bspa\b/],
  ["nailart", /sticker|calcoman|decora|foil|glitter|strass|piedra|nail ?art|liner|stamping|sello|encapsul|pigmento/],
  ["acrilico", /acril|poly ?gel|monomer|polvo|\btips?\b|press.?on|molde/],
  ["herramientas", /\blima|buffer|pulidor|torno|drill|fresa|pusher|empujador|alicate|cortau|tijera|pinza|guante|pincel|brocha|cepillo|esteriliza/],
  ["geles", /\bgel|semipermanente|esmalte|top ?coat|\bbase\b|rubber|builder|primer|deshidratador/],
];

/** The sync's guess of a product's category from its name and Marcolini's
 * hints (the store's category, the brand's collections). null = no clue:
 * the product only shows under "Todo" until the admin picks one. */
export function guessCategory(name: string, hints: (string | null | undefined)[] = []): CuponeraCategory | null {
  const text = normalizeText([name, ...hints].filter(Boolean).join(" "));
  for (const [key, rule] of CATEGORY_RULES) {
    if (rule.test(text)) return key;
  }
  return null;
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
