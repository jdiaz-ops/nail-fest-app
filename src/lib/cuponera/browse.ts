// How visitors browse the public cuponera: the search box, the filters
// (category, color, size), the sort and the line cards — every tone of a
// line in one card. Pure functions over the products the page already has:
// they run in the browser on every keystroke.

import {
  CATEGORY_KEYS,
  COLOR_FAMILIES,
  CUPONERA_CATEGORIES,
  SHADE_CATEGORIES,
  categoryLabel,
  discountPercent,
  normalizeText,
  subcategoriesOf,
  subcategoryLabel,
  type CuponeraCategory,
  type CuponeraProduct,
  type CuponeraSubcategory,
} from "./shared";

// ── Line cards ─────────────────────────────────────────────────────────────

export interface CuponeraLine {
  key: string;
  brand: string;
  /** "Gel Polish Rosados" — the line as Marcolini names it. */
  name: string;
  members: CuponeraProduct[];
}

export type CuponeraTile = { kind: "product"; key: string; product: CuponeraProduct } | { kind: "line"; key: string; line: CuponeraLine };

/** Products of one brand and line ("Gel Polish – Princesa", "Gel Polish –
 * Bailarina"…) as a single card, where the first of them was. A line left
 * with one product (after the filters) is a plain product card. */
export function groupByLine(products: CuponeraProduct[]): CuponeraTile[] {
  const tiles: CuponeraTile[] = [];
  const lines = new Map<string, CuponeraLine>();
  for (const product of products) {
    const lineName = product.line?.trim();
    if (!lineName) {
      tiles.push({ kind: "product", key: product.id, product });
      continue;
    }
    const key = `line:${product.brand}|${normalizeText(lineName)}`;
    const existing = lines.get(key);
    if (existing) {
      existing.members.push(product);
      continue;
    }
    const line: CuponeraLine = { key, brand: product.brand, name: lineName, members: [product] };
    lines.set(key, line);
    tiles.push({ kind: "line", key, line });
  }
  return tiles.map((tile) =>
    tile.kind === "line" && tile.line.members.length === 1 ? { kind: "product", key: tile.line.members[0]!.id, product: tile.line.members[0]! } : tile,
  );
}

export function tileProducts(tile: CuponeraTile): CuponeraProduct[] {
  return tile.kind === "product" ? [tile.product] : tile.line.members;
}

// A line of shades (a color family, or a shade category) has "tonos";
// anything else has "versiones".
export function lineCountLabel(line: CuponeraLine): string {
  const n = line.members.length;
  const shades = line.members.some((p) => p.colorFamily) || line.members.some((p) => p.category !== null && SHADE_CATEGORIES.has(p.category));
  return shades ? `${n} tonos` : `${n} versiones`;
}

/** What a tone is called inside its line card: Marcolini's tone/variant,
 * or the name without the line in front ("Gel Polish – Princesa" →
 * "Princesa"). */
export function toneName(product: CuponeraProduct, lineName: string): string {
  const variant = product.variant?.trim();
  if (variant) return variant;
  const name = product.name.trim();
  if (normalizeText(name).startsWith(normalizeText(lineName))) {
    const rest = name.slice(lineName.length).replace(/^[\s–—\-·|:,]+/, "").trim();
    if (rest) return rest;
  }
  return name;
}

export function cheapest(products: CuponeraProduct[]): CuponeraProduct {
  return products.reduce((low, p) => (p.price < low.price ? p : low), products[0]!);
}

/** Every review of the products together: the average weighted by how
 * many reviews each one has. */
export function combinedRating(products: CuponeraProduct[]): { average: number; count: number } | null {
  let sum = 0;
  let count = 0;
  for (const p of products) {
    if (!p.rating) continue;
    sum += p.rating.average * p.rating.count;
    count += p.rating.count;
  }
  return count > 0 ? { average: sum / count, count } : null;
}

// ── Search ─────────────────────────────────────────────────────────────────

// "15ml" and "15 ml" are the same search.
function searchable(text: string): string {
  return normalizeText(text).replace(/(\d)([a-z])/g, "$1 $2");
}

export function searchWords(query: string): string[] {
  return searchable(query).split(" ").filter(Boolean);
}

function singularWord(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

// A search word matches the start of a word in the text — "rosa" finds
// "Rosados", "gel" doesn't find "angel" — in singular or plural.
function hasWord(haystack: string, word: string): boolean {
  return haystack.includes(` ${word}`) || haystack.includes(` ${singularWord(word)}`);
}

// Each product's searchable text, worked out once (the products are the
// same objects on every keystroke).
const textCache = new WeakMap<CuponeraProduct, { main: string; all: string }>();

function productTexts(p: CuponeraProduct): { main: string; all: string } {
  let texts = textCache.get(p);
  if (!texts) {
    const parts = [p.name, p.brand, p.line, p.variant, p.colorFamily, p.size];
    if (p.category) parts.push(categoryLabel(p.category), subcategoryLabel(p.category, p.subcategory));
    const main = ` ${searchable(parts.filter(Boolean).join(" "))}`;
    texts = { main, all: p.description ? `${main} ${searchable(p.description)}` : main };
    textCache.set(p, texts);
  }
  return texts;
}

/** 2 = every word of the search is in the product's name, brand, line,
 * tone, color, size or category; 1 = only counting its description (shown
 * after the others: a gel's description often mentions the lamp); 0 = no. */
export function searchScore(p: CuponeraProduct, words: string[]): number {
  if (words.length === 0) return 2;
  const { main, all } = productTexts(p);
  if (words.every((w) => hasWord(main, w))) return 2;
  return all !== main && words.every((w) => hasWord(all, w)) ? 1 : 0;
}

// ── Navigation ─────────────────────────────────────────────────────────────

export interface CuponeraCategoryLink {
  key: CuponeraCategory;
  label: string;
  chip: string;
  count: number;
  subcategories: (CuponeraSubcategory & { count: number })[];
}

/** The categories and types that have products (the menu, the chips). */
export function categoryTree(products: CuponeraProduct[]): CuponeraCategoryLink[] {
  return CATEGORY_KEYS.map((key) => {
    const inCategory = products.filter((p) => p.category === key);
    return {
      key,
      label: categoryLabel(key),
      chip: CUPONERA_CATEGORIES.find((c) => c.key === key)?.chip ?? categoryLabel(key),
      count: inCategory.length,
      subcategories: subcategoriesOf(key)
        .map((s) => ({ ...s, count: inCategory.filter((p) => p.subcategory === s.key).length }))
        .filter((s) => s.count > 0),
    };
  }).filter((c) => c.count > 0);
}

/** A collection's address: /cuponera/esmaltes, /cuponera/esmaltes/semipermanente. */
export function collectionHref(category: CuponeraCategory, subcategory?: string | null): string {
  return subcategory ? `/cuponera/${category}/${subcategory}` : `/cuponera/${category}`;
}

/** A sliding row of the front page. */
export interface CuponeraRow {
  key: string;
  title: string;
  subtitle: string | null;
  /** "Ver todo". */
  href: string | null;
  tiles: CuponeraTile[];
  ranked?: boolean;
  /** "Nuevo" instead of the discount on the photo. */
  isNew?: boolean;
}

/** One of the admin's lists, with its products (lib/cuponera/lists.ts). */
export interface CuponeraListPage {
  slug: string;
  title: string;
  subtitle: string | null;
  kind: "category" | "products";
  category: CuponeraCategory | null;
  subcategory: string | null;
  products: CuponeraProduct[];
}

/** Where a list's "Ver todo" goes: its category's collection, or its own page. */
export function listHref(list: Pick<CuponeraListPage, "slug" | "category" | "subcategory">): string {
  return list.category ? collectionHref(list.category, list.subcategory) : `/cuponera/lista/${list.slug}`;
}

const ROW_TILES = 12;
const BESTSELLER_TILES = 8;
// A category row with fewer products than this would look broken.
const CATEGORY_ROW_MIN = 2;

/** The front page below the search: what the community buys most, the
 * admin's lists in their order, what's new. Rows with nothing to show are
 * left out. A category list groups the tones of a line in one card; chosen
 * products stay one by one, as the admin picked them. */
export function frontPageRows(input: {
  bestsellers: CuponeraTile[];
  lists: CuponeraListPage[];
  newProducts: CuponeraProduct[];
  newTitle: string;
  newSubtitle: string;
}): CuponeraRow[] {
  const rows: CuponeraRow[] = [];
  if (input.bestsellers.length > 0) {
    rows.push({
      key: "lo-mas-comprado",
      title: "Lo más comprado por la comunidad",
      subtitle: "Con los códigos de Nail Fest, últimos 90 días",
      href: "/cuponera/lo-mas-comprado",
      tiles: input.bestsellers.slice(0, BESTSELLER_TILES),
      ranked: true,
    });
  }
  for (const list of input.lists) {
    const enough = list.kind === "category" ? list.products.length >= CATEGORY_ROW_MIN : list.products.length > 0;
    if (!enough) continue;
    const tiles: CuponeraTile[] =
      list.kind === "category" ? groupByLine(list.products) : list.products.map((product) => ({ kind: "product", key: product.id, product }));
    rows.push({ key: `lista-${list.slug}`, title: list.title, subtitle: list.subtitle, href: listHref(list), tiles: tiles.slice(0, ROW_TILES) });
  }
  if (input.newProducts.length > 0) {
    rows.push({
      key: "lo-nuevo",
      title: input.newTitle,
      subtitle: input.newSubtitle,
      href: "/cuponera/lo-nuevo",
      tiles: groupByLine(input.newProducts).slice(0, ROW_TILES),
      isNew: true,
    });
  }
  return rows;
}

// ── Filters ────────────────────────────────────────────────────────────────

/** The categories that have products, in the chips' order. */
export function categoriesPresent(products: CuponeraProduct[]): CuponeraCategory[] {
  return CATEGORY_KEYS.filter((key) => products.some((p) => p.category === key));
}

export function subcategoriesPresent(products: CuponeraProduct[], category: CuponeraCategory): CuponeraSubcategory[] {
  return subcategoriesOf(category).filter((s) => products.some((p) => p.category === category && p.subcategory === s.key));
}

/** The color families present, in the filter's order. */
export function colorsPresent(products: CuponeraProduct[]): { name: string; swatch: string; count: number }[] {
  return COLOR_FAMILIES.map((f) => ({ ...f, count: products.filter((p) => p.colorFamily === f.name).length })).filter((f) => f.count > 0);
}

const UNIT_ORDER = ["ml", "l", "oz", "g", "kg", "und"];

function sizeParts(size: string): [number, number] {
  const [amount = "", unit = ""] = size.split(" ");
  const index = UNIT_ORDER.indexOf(unit);
  return [index === -1 ? UNIT_ORDER.length : index, Number(amount.replace(",", ".")) || 0];
}

/** The sizes present, small to big within each unit ("15 ml", "30 ml", "30 g"). */
export function sizesPresent(products: CuponeraProduct[]): string[] {
  const sizes = [...new Set(products.map((p) => p.size).filter((s): s is string => Boolean(s)))];
  return sizes.sort((a, b) => {
    const [ua, va] = sizeParts(a);
    const [ub, vb] = sizeParts(b);
    return ua - ub || va - vb || a.localeCompare(b, "es");
  });
}

// ── Sort ───────────────────────────────────────────────────────────────────

export type CuponeraSort = "recomendados" | "calificados" | "vendidos" | "descuento" | "precio";

const SORT_LABELS: Record<CuponeraSort, string> = {
  recomendados: "Recomendados",
  calificados: "Mejor calificados",
  vendidos: "Más vendidos",
  descuento: "Mayor descuento",
  precio: "Menor precio",
};

/** The sorts that mean something for these products: no "Mejor
 * calificados" without reviews, no "Más vendidos" without sales, no
 * "Mayor descuento" when every discount is the same. */
export function sortOptions(products: CuponeraProduct[]): { key: CuponeraSort; label: string }[] {
  const keys: CuponeraSort[] = ["recomendados"];
  if (products.some((p) => p.rating)) keys.push("calificados");
  if (products.some((p) => p.soldWithCode > 0)) keys.push("vendidos");
  if (new Set(products.map((p) => discountPercent(p.price, p.before))).size > 1) keys.push("descuento");
  keys.push("precio");
  return keys.map((key) => ({ key, label: SORT_LABELS[key] }));
}

// "Mejor calificados" pulls each average toward 4 stars with 5 phantom
// reviews, so a lone 5★ doesn't go ahead of a 4,8★ with a hundred reviews.
const RATING_PRIOR = 4;
const RATING_WEIGHT = 5;

function sortScore(tile: CuponeraTile, sort: CuponeraSort): number {
  const products = tileProducts(tile);
  switch (sort) {
    case "calificados": {
      const rating = combinedRating(products);
      return rating ? (rating.average * rating.count + RATING_PRIOR * RATING_WEIGHT) / (rating.count + RATING_WEIGHT) : -1;
    }
    case "vendidos":
      return products.reduce((sum, p) => sum + p.soldWithCode, 0);
    case "descuento":
      return Math.max(...products.map((p) => discountPercent(p.price, p.before)));
    case "precio":
      return -cheapest(products).price;
    default:
      return 0;
  }
}

/** Ties keep the order they came in (the admin's, or the search's). */
export function sortTiles(tiles: CuponeraTile[], sort: CuponeraSort): CuponeraTile[] {
  if (sort === "recomendados") return tiles;
  return tiles
    .map((tile, index) => ({ tile, index, score: sortScore(tile, sort) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.tile);
}
