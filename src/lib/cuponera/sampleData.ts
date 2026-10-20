// Sample content for the cuponera preview (nailfest.lat/cuponera) until a
// real source exists — the admin module or Marcolini's catalog. Brands are
// "Marca A, B, C…" on purpose: nothing here is a real offer, and the page
// that shows it is staff-only (see src/app/cuponera/page.tsx).

import type {
  CuponeraBrandCard,
  CuponeraCategory,
  CuponeraCoupon,
  CuponeraDesign,
  CuponeraList,
  CuponeraProduct,
  CuponeraProfession,
  ProductIconKind,
} from "./shared";

const p = (
  id: string,
  brand: string,
  name: string,
  price: number,
  before: number,
  icon: ProductIconKind,
  color: string,
  tint: string,
  where: `${CuponeraCategory}` | `${CuponeraCategory}/${string}`,
  professions: CuponeraProfession[],
): CuponeraProduct => {
  const [category, subcategory] = where.split("/") as [CuponeraCategory, string | undefined];
  return {
    id,
    brand,
    name,
    price,
    before,
    priceFrom: false,
    code: "NAILFEST",
    imageUrl: null,
    icon,
    color,
    tint,
    category,
    subcategory: subcategory ?? null,
    professions,
    url: null,
    colorFamily: null,
    size: null,
    line: null,
    variant: null,
    variantCount: 0,
    variantsLabel: null,
    rating: null,
    unitsLeft: null,
    soldWithCode: 0,
    description: null,
  };
};

// The three gels of Marca A are one line: the page shows them as a single
// "3 tonos" card, like a real brand's tones.
const gelLine = (variant: string, colorFamily: string, extra: Partial<CuponeraProduct> = {}): Partial<CuponeraProduct> => ({
  line: "Gel semipermanente",
  variant,
  colorFamily,
  size: "15 ml",
  ...extra,
});

export const SAMPLE_PRODUCTS: CuponeraProduct[] = [
  {
    ...p("gel-rosa", "Marca A", "Gel semipermanente Rosa chicle 15 ml", 27200, 32000, "bottle", "#f48fb1", "#fde8ef", "esmaltes/semipermanente", ["mani"]),
    ...gelLine("Rosa chicle", "Rosados", { rating: { average: 4.8, count: 23 } }),
  },
  {
    ...p("gel-verde", "Marca A", "Gel semipermanente Verde selva 15 ml", 27200, 32000, "bottle", "#00beb5", "#e6f9f7", "esmaltes/semipermanente", ["mani"]),
    ...gelLine("Verde selva", "Verdes", { rating: { average: 4.6, count: 8 }, unitsLeft: 3 }),
  },
  {
    ...p("gel-coral", "Marca A", "Gel semipermanente Coral 15 ml", 27200, 32000, "bottle", "#ff8a65", "#fff3ea", "esmaltes/semipermanente", ["mani"]),
    ...gelLine("Coral", "Corales y naranjas"),
  },
  {
    ...p("base-rubber", "Marca B", "Base rubber nivelante 15 ml", 30600, 36000, "bottle", "#f6e3d8", "#fff3ea", "construccion/rubber", ["mani"]),
    size: "15 ml",
    colorFamily: "Nudes",
    rating: { average: 4.7, count: 12 },
  },
  { ...p("tips-almendra", "Marca D", "Tips almendra transparentes x500", 25500, 30000, "tips", "#ffffff", "#e6f9f7", "softgel/tips", ["mani"]), size: "500 und" },
  p("aceite-cuticula", "Marca E", "Aceite de cutícula de almendras 30 ml", 13600, 16000, "drop", "#f2b01e", "#fdf3d6", "cuidado/cuticulas", ["mani"]),
  p("kit-acrilico", "Marca C", "Kit de acrílico para empezar", 119200, 149000, "kit", "#ffc5a8", "#fff3ea", "kits", ["est"]),
  p("limas-buffers", "Marca D", "Limas y buffers x10", 16200, 18000, "file", "#ffc5a8", "#f3f1ee", "herramientas/limas", ["est"]),
  p("pincel-liner", "Marca B", "Pincel liner 00 para nail art", 12750, 15000, "brush", "#17181c", "#e6f9f7", "herramientas/pinceles", ["est"]),
  p("trio-geles", "Marca A", "Trío de geles básicos 15 ml", 68000, 80000, "bottle", "#00beb5", "#e6f9f7", "esmaltes/semipermanente", ["est"]),
  { ...p("lampara-36", "Marca C", "Lámpara LED/UV 36 W", 97750, 115000, "lamp", "none", "#f3f1ee", "herramientas/lamparas", ["salon"]), rating: { average: 4.9, count: 41 } },
  p("guantes", "Marca E", "Guantes de nitrilo x100", 25200, 28000, "kit", "#c4efeb", "#e6f9f7", "cuidado", ["salon"]),
  p("top-coat-30", "Marca A", "Top coat sin residuo 30 ml", 40800, 48000, "bottle", "#ffffff", "#f3f1ee", "cuidado/top-base", ["salon"]),
  p("torno", "Marca F", "Torno eléctrico profesional", 212500, 250000, "drill", "#ffc5a8", "#fff3ea", "herramientas/tornos", ["salon"]),
  { ...p("esmalte-coral", "Marca A", "Esmalte efecto gel Coral", 15300, 18000, "bottle", "#ff8a65", "#fff3ea", "esmaltes/tradicional", ["casa"]), colorFamily: "Corales y naranjas" },
  {
    ...p("press-on", "Marca D", "Uñas press-on almendra x24", 22950, 27000, "tips", "#f48fb1", "#fde8ef", "softgel/press-on", ["casa"]),
    colorFamily: "Rosados",
    variantCount: 4,
    variantsLabel: "4 diseños",
  },
  p("quitaesmalte", "Marca E", "Quitaesmalte sin acetona 120 ml", 10200, 12000, "drop", "#c4efeb", "#e6f9f7", "cuidado/cuticulas", ["casa"]),
  p("stickers", "Marca B", "Stickers de nail art Selva Pop", 8500, 10000, "star", "#f2b01e", "#fdf3d6", "decoracion/stickers", ["casa"]),
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
  "herramientas/lamparas",
  ["salon", "mani"],
);

export const SAMPLE_NEW: CuponeraProduct[] = [
  p("coleccion-selva", "Marca A", "Colección Selva Pop, 6 geles", 163200, 192000, "bottle", "#00beb5", "#e6f9f7", "esmaltes/semipermanente", ["mani", "salon"]),
  p("torno-bolsillo", "Marca F", "Torno inalámbrico de bolsillo", 178500, 210000, "drill", "#ffc5a8", "#fff3ea", "herramientas/tornos", ["mani", "salon"]),
];

const sampleBrand = (
  letter: string,
  tone: CuponeraBrandCard["tone"],
  discountPercent: number,
  code: string,
  extra: Partial<CuponeraBrandCard> = {},
): CuponeraBrandCard => ({
  id: `marca-${letter.toLowerCase()}`,
  name: `Marca ${letter}`,
  initial: letter,
  logoUrl: null,
  tone,
  discountPercent,
  code,
  storeUrl: null,
  title: `${discountPercent} % de descuento`,
  exclusive: false,
  shipping: null,
  inPanel: true,
  ...extra,
});

export const SAMPLE_BRANDS: CuponeraBrandCard[] = [
  sampleBrand("A", "pink", 15, "NAILFEST15", { title: "15 % en toda la tienda", exclusive: true, shipping: "Envío gratis desde $150.000" }),
  sampleBrand("B", "teal", 15, "NAILFEST", { title: "Envío gratis desde $120.000" }),
  sampleBrand("C", "peach", 20, "NAILFEST20"),
  sampleBrand("D", "pink", 15, "NAILFEST"),
  sampleBrand("E", "teal", 10, "NAILFEST"),
  sampleBrand("F", "peach", 15, "NAILFEST", { title: "2 × 1 en fresas" }),
];

// The examples that fill the coupons panel for the team while there are
// few real brands ("Marca A" to "Marca Q"): enough to slide through, none a
// real offer — they open no store (storeUrl null).
const EXAMPLE_TONES: CuponeraBrandCard["tone"][] = ["pink", "teal", "peach"];
const EXAMPLE_OFFERS: [number, string][] = [
  [15, "NAILFEST15"],
  [10, "NAILFEST"],
  [20, "NAILFEST20"],
  [12, "NAILFEST12"],
  [25, "NAILFEST25"],
];
export const EXAMPLE_PANEL_BRANDS: CuponeraBrandCard[] = "ABCDEFGHIJKLMNOPQ".split("").map((letter, i) => {
  const [percent, code] = EXAMPLE_OFFERS[i % EXAMPLE_OFFERS.length]!;
  return sampleBrand(letter, EXAMPLE_TONES[i % EXAMPLE_TONES.length]!, percent, code);
});

export const SAMPLE_COUPONS: CuponeraCoupon[] = [
  {
    id: "marca-a",
    brand: "Marca A",
    initial: "A",
    logoUrl: null,
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
    logoUrl: null,
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
    logoUrl: null,
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
