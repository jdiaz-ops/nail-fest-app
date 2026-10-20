// Sample content for the cuponera preview (nailfest.lat/cuponera) until a
// real source exists — the admin module or Marcolini's catalog. Brands are
// "Marca A, B, C…" on purpose: nothing here is a real offer, and the page
// that shows it is staff-only (see src/app/cuponera/page.tsx).

export type ProductIconKind = "bottle" | "drop" | "tips" | "lamp" | "brush" | "kit" | "file" | "star" | "drill";
export type CuponeraCategory = "geles" | "acrilico" | "lamparas" | "herramientas" | "cuidado" | "nailart";
export type CuponeraProfession = "mani" | "est" | "salon" | "casa";

export interface CuponeraProduct {
  id: string;
  brand: string;
  name: string;
  /** Price with Nail Fest's discount, whole COP. */
  price: number;
  /** Store price before the discount, whole COP. */
  before: number;
  icon: ProductIconKind;
  /** Product color drawn inside the icon. */
  color: string;
  /** Photo background. */
  tint: string;
  category: CuponeraCategory;
  professions: CuponeraProfession[];
  /** Brand store link carrying Nail Fest's code; null in the preview. */
  url: string | null;
}

export interface CuponeraCoupon {
  id: string;
  brand: string;
  initial: string;
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

export const CUPONERA_PROFESSIONS: { key: CuponeraProfession; label: string; plural: string }[] = [
  { key: "mani", label: "Manicurista", plural: "manicuristas" },
  { key: "est", label: "Estudiante", plural: "estudiantes" },
  { key: "salon", label: "Salón", plural: "salones" },
  { key: "casa", label: "Me pinto en casa", plural: "las que se pintan en casa" },
];

const p = (
  id: string,
  brand: string,
  name: string,
  price: number,
  before: number,
  icon: ProductIconKind,
  color: string,
  tint: string,
  category: CuponeraCategory,
  professions: CuponeraProfession[],
): CuponeraProduct => ({ id, brand, name, price, before, icon, color, tint, category, professions, url: null });

export const SAMPLE_PRODUCTS: CuponeraProduct[] = [
  p("gel-rosa", "Marca A", "Gel semipermanente Rosa chicle 15 ml", 27200, 32000, "bottle", "#f48fb1", "#fde8ef", "geles", ["mani"]),
  p("base-rubber", "Marca B", "Base rubber nivelante 15 ml", 30600, 36000, "bottle", "#f6e3d8", "#fff3ea", "geles", ["mani"]),
  p("tips-almendra", "Marca D", "Tips almendra transparentes x500", 25500, 30000, "tips", "#ffffff", "#e6f9f7", "acrilico", ["mani"]),
  p("aceite-cuticula", "Marca E", "Aceite de cutícula de almendras 30 ml", 13600, 16000, "drop", "#f2b01e", "#fdf3d6", "cuidado", ["mani"]),
  p("kit-acrilico", "Marca C", "Kit de acrílico para empezar", 119200, 149000, "kit", "#ffc5a8", "#fff3ea", "acrilico", ["est"]),
  p("limas-buffers", "Marca D", "Limas y buffers x10", 16200, 18000, "file", "#ffc5a8", "#f3f1ee", "herramientas", ["est"]),
  p("pincel-liner", "Marca B", "Pincel liner 00 para nail art", 12750, 15000, "brush", "#17181c", "#e6f9f7", "nailart", ["est"]),
  p("trio-geles", "Marca A", "Trío de geles básicos 15 ml", 68000, 80000, "bottle", "#00beb5", "#e6f9f7", "geles", ["est"]),
  p("lampara-36", "Marca C", "Lámpara LED/UV 36 W", 97750, 115000, "lamp", "none", "#f3f1ee", "lamparas", ["salon"]),
  p("guantes", "Marca E", "Guantes de nitrilo x100", 25200, 28000, "kit", "#c4efeb", "#e6f9f7", "herramientas", ["salon"]),
  p("top-coat-30", "Marca A", "Top coat sin residuo 30 ml", 40800, 48000, "bottle", "#ffffff", "#f3f1ee", "geles", ["salon"]),
  p("torno", "Marca F", "Torno eléctrico profesional", 212500, 250000, "drill", "#ffc5a8", "#fff3ea", "herramientas", ["salon"]),
  p("esmalte-coral", "Marca A", "Esmalte efecto gel Coral", 15300, 18000, "bottle", "#ff8a65", "#fff3ea", "geles", ["casa"]),
  p("press-on", "Marca D", "Uñas press-on almendra x24", 22950, 27000, "tips", "#f48fb1", "#fde8ef", "nailart", ["casa"]),
  p("quitaesmalte", "Marca E", "Quitaesmalte sin acetona 120 ml", 10200, 12000, "drop", "#c4efeb", "#e6f9f7", "cuidado", ["casa"]),
  p("stickers", "Marca B", "Stickers de nail art Selva Pop", 8500, 10000, "star", "#f2b01e", "#fdf3d6", "nailart", ["casa"]),
];

export const SAMPLE_DEAL: CuponeraProduct = p(
  "lampara-48",
  "Marca C",
  "Lámpara LED/UV 48 W con temporizador",
  89400,
  149000,
  "lamp",
  "none",
  "#f3f1ee",
  "lamparas",
  ["salon", "mani"],
);

export const SAMPLE_NEW: CuponeraProduct[] = [
  p("coleccion-selva", "Marca A", "Colección Selva Pop, 6 geles", 163200, 192000, "bottle", "#00beb5", "#e6f9f7", "geles", ["mani", "salon"]),
  p("torno-bolsillo", "Marca F", "Torno inalámbrico de bolsillo", 178500, 210000, "drill", "#ffc5a8", "#fff3ea", "herramientas", ["mani", "salon"]),
];

export const SAMPLE_COUPONS: CuponeraCoupon[] = [
  {
    id: "marca-a",
    brand: "Marca A",
    initial: "A",
    tone: "pink",
    title: "15 % en toda la tienda",
    code: "NAILFEST15",
    conditions: [
      "Compra mínima $80.000",
      "Vence el 31 de diciembre",
      "No se acumula con otras promociones",
      "No aplica en productos que ya tienen descuento",
    ],
    exclusive: true,
    url: null,
  },
  {
    id: "marca-b",
    brand: "Marca B",
    initial: "B",
    tone: "teal",
    title: "Envío gratis desde $120.000",
    code: "NAILFESTENVIOGRATIS",
    conditions: ["Una vez por persona", "Vence el 15 de diciembre", "Envíos dentro de Colombia"],
    exclusive: false,
    url: null,
  },
  {
    id: "marca-c",
    brand: "Marca C",
    initial: "C",
    tone: "peach",
    title: "2 × 1 en limas y buffers",
    code: "NAILFEST2X1",
    conditions: ["Hasta agotar existencias", "Solo en la tienda en línea"],
    exclusive: false,
    url: null,
  },
];

export const SAMPLE_DESIGN: CuponeraDesign = {
  title: "Selva Pop",
  headline: "Selva Pop, de la demo de nail art",
  credit: "Diseño de [nombre de la educadora] · Nail Fest Cúcuta 2026",
  items: [
    { name: "Gel Rosa chicle 15 ml", brand: "Marca A", price: 27200, before: 32000, color: "#f48fb1", url: null },
    { name: "Gel Verde selva 15 ml", brand: "Marca A", price: 27200, before: 32000, color: "#00beb5", url: null },
    { name: "Puntos de nail art, 6 tonos", brand: "Marca B", price: 21250, before: 25000, color: "#f2b01e", url: null },
    { name: "Top coat sin residuo 15 ml", brand: "Marca C", price: 23800, before: 28000, color: "#ffffff", url: null },
  ],
};

export const SAMPLE_LISTS: CuponeraList[] = [
  { id: "kit-acrilico", title: "Kit para empezar en acrílico", author: "[educadora]", count: 8, swatches: ["#fff3ea", "#fde8ef", "#e6f9f7", "#f3f1ee"] },
  { id: "demo-selva", title: "Todo lo de la demo Selva Pop", author: "[educadora]", count: 6, swatches: ["#fde8ef", "#00beb5", "#f2b01e", "#ffc5a8"] },
  { id: "cabina", title: "Esenciales de cabina", author: "[educadora]", count: 10, swatches: ["#e6f9f7", "#f3f1ee", "#fff3ea", "#fde8ef"] },
];

export function formatCop(value: number): string {
  return `$${value.toLocaleString("es-CO")}`;
}

export function discountPercent(price: number, before: number): number {
  return before > 0 ? Math.round((1 - price / before) * 100) : 0;
}
