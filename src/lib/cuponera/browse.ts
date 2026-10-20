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
  formatPercent,
  normalizeText,
  subcategoriesOf,
  subcategoryLabel,
  type CuponeraBrandCard,
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
  bestsellersTitle: string;
  bestsellersSubtitle: string;
  newTitle: string;
  newSubtitle: string;
}): CuponeraRow[] {
  const rows: CuponeraRow[] = [];
  if (input.bestsellers.length > 0) {
    rows.push({
      key: "lo-mas-comprado",
      title: input.bestsellersTitle,
      subtitle: input.bestsellersSubtitle,
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

/** A tile of "Explora ahorros por categoría": a category, or another way
 * into the products when the categories leave the last row short. */
export interface CuponeraCategoryTile {
  key: string;
  /** Which drawing it shows (components/cuponera/categoryArt.ts). */
  art: CuponeraCategory | "lo-mas-comprado" | "lo-nuevo" | "lista" | "marcas" | "todo";
  label: string;
  count: string;
  href: string;
  /** The admin's picture, for a category that has one. */
  image?: string;
}

const productCountLabel = (n: number) => (n === 1 ? "1 producto" : `${n} productos`);
const tileProductCount = (tiles: CuponeraTile[]) => tiles.reduce((sum, t) => sum + (t.kind === "line" ? t.line.members.length : 1), 0);

/** The tiles under the search: every category with products; then, when
 * they leave the last row of three short, other ways in (what sells, what's
 * new, the admin's product lists, the brands) and "Todo" to close it. */
export function categoryTiles(
  input: {
    categories: CuponeraCategoryLink[];
    images: Record<string, string>;
    bestsellers: CuponeraTile[];
    newProducts: CuponeraProduct[];
    lists: CuponeraListPage[];
    /** 0 when "Todas las marcas" isn't on the page to jump to. */
    brandCount: number;
    productCount: number;
  },
  columns = 3,
): CuponeraCategoryTile[] {
  const tiles: CuponeraCategoryTile[] = input.categories.map((c) => ({
    key: c.key,
    art: c.key,
    label: c.chip,
    count: productCountLabel(c.count),
    href: collectionHref(c.key),
    image: input.images[c.key],
  }));
  const missing = (columns - (tiles.length % columns)) % columns;
  if (missing === 0) return tiles;
  const extras: CuponeraCategoryTile[] = [];
  if (input.bestsellers.length > 0) {
    extras.push({ key: "lo-mas-comprado", art: "lo-mas-comprado", label: "Lo más comprado", count: productCountLabel(tileProductCount(input.bestsellers)), href: "/cuponera/lo-mas-comprado" });
  }
  if (input.newProducts.length > 0) {
    extras.push({ key: "lo-nuevo", art: "lo-nuevo", label: "Lo nuevo", count: productCountLabel(input.newProducts.length), href: "/cuponera/lo-nuevo" });
  }
  for (const list of input.lists) {
    if (list.kind === "products" && list.products.length > 0) {
      extras.push({ key: `lista-${list.slug}`, art: "lista", label: list.title, count: productCountLabel(list.products.length), href: listHref(list) });
    }
  }
  if (input.brandCount > 0) {
    extras.push({ key: "marcas", art: "marcas", label: "Marcas", count: input.brandCount === 1 ? "1 marca" : `${input.brandCount} marcas`, href: "#marcas" });
  }
  const todo: CuponeraCategoryTile = { key: "todo", art: "todo", label: "Todo", count: productCountLabel(input.productCount), href: "/cuponera/todo" };
  return [...tiles, ...extras.slice(0, missing - 1), todo];
}

// ── Search suggestions ─────────────────────────────────────────────────────

/** Something the front page's search box offers while typing. */
export interface CuponeraSuggestion {
  kind: "marca" | "categoria" | "producto";
  label: string;
  detail: string;
  href: string;
  /** How much is behind it (products): the bigger, the higher. */
  weight: number;
  /** A category's (or its type's) key, for its drawing. */
  category?: CuponeraCategory;
  /** A brand's logo. */
  logo?: Pick<CuponeraBrandCard, "logoUrl" | "initial" | "tone">;
}

const searchHref = (text: string) => `/cuponera/buscar?q=${encodeURIComponent(text)}`;

/** Everything the search box can suggest, all of it real: the brands (with
 * their discount and code), the categories and their types, the products
 * (a line once). */
export function suggestionIndex(products: CuponeraProduct[], brands: CuponeraBrandCard[], categories: CuponeraCategoryLink[]): CuponeraSuggestion[] {
  const perBrand = new Map<string, number>();
  for (const p of products) perBrand.set(p.brand, (perBrand.get(p.brand) ?? 0) + 1);
  const index: CuponeraSuggestion[] = brands.map((b) => ({
    kind: "marca",
    label: b.name,
    detail: `${formatPercent(b.discountPercent)} de descuento con el código ${b.code}`,
    href: searchHref(b.name),
    weight: perBrand.get(b.name) ?? 0,
    logo: { logoUrl: b.logoUrl, initial: b.initial, tone: b.tone },
  }));
  for (const c of categories) {
    index.push({ kind: "categoria", label: c.label, detail: productCountLabel(c.count), href: collectionHref(c.key), weight: c.count, category: c.key });
    for (const sub of c.subcategories) {
      index.push({ kind: "categoria", label: sub.label, detail: `${c.chip} · ${productCountLabel(sub.count)}`, href: collectionHref(c.key, sub.key), weight: sub.count, category: c.key });
    }
  }
  for (const tile of groupByLine(products)) {
    const label = tile.kind === "line" ? tile.line.name : tile.product.name;
    const detail = tile.kind === "line" ? `${tile.line.brand} · ${lineCountLabel(tile.line)}` : tile.product.brand;
    index.push({ kind: "producto", label, detail, href: searchHref(label), weight: tile.kind === "line" ? tile.line.members.length : 1 });
  }
  return index;
}

/** A label folded like normalizeText, remembering which character of the
 * original each one came from — so a match can be bolded there. */
export function foldLabel(label: string): { text: string; from: number[] } {
  let text = "";
  const from: number[] = [];
  for (let i = 0; i < label.length; i++) {
    for (const ch of label[i]!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) {
      if (/[a-z0-9]/.test(ch)) {
        text += ch;
        from.push(i);
      } else if (text && !text.endsWith(" ")) {
        text += " ";
        from.push(i);
      }
    }
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    from.pop();
  }
  return { text, from };
}

// Where a search word starts a word of the folded label, or -1.
function wordAt(text: string, word: string): number {
  if (text.startsWith(word)) return 0;
  const at = text.indexOf(` ${word}`);
  return at < 0 ? -1 : at + 1;
}

/** 3 = the label starts with what's typed, 2 = every word typed starts a
 * word of the label, 1 = it's inside the label (from four letters on, so
 * "la" doesn't bring up every "lámpara"), 0 = no. */
export function suggestionScore(label: string, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const { text } = foldLabel(label);
  if (text.startsWith(q)) return 3;
  if (q.split(" ").every((w) => wordAt(text, w) >= 0)) return 2;
  return q.length >= 4 && text.includes(q) ? 1 : 0;
}

const SUGGESTION_KINDS = { marca: 0, categoria: 1, producto: 2 } as const;
const SUGGESTION_LIMITS = { marca: 3, categoria: 3, producto: 4 } as const;

/** The suggestions for what's typed: brands, then categories, then
 * products, each by how well it matches and how much is behind it. */
export function rankSuggestions(index: CuponeraSuggestion[], query: string): CuponeraSuggestion[] {
  const scored = index.map((s) => ({ s, score: suggestionScore(s.label, query) })).filter((e) => e.score > 0);
  scored.sort(
    (a, b) =>
      SUGGESTION_KINDS[a.s.kind] - SUGGESTION_KINDS[b.s.kind] || b.score - a.score || b.s.weight - a.s.weight || a.s.label.length - b.s.label.length,
  );
  const taken = { marca: 0, categoria: 0, producto: 0 };
  const seen = new Set<string>();
  return scored
    .filter(({ s }) => {
      if (taken[s.kind] >= SUGGESTION_LIMITS[s.kind] || seen.has(s.href)) return false;
      taken[s.kind]++;
      seen.add(s.href);
      return true;
    })
    .map((e) => e.s);
}

/** A label cut in pieces, true = what matched the search (in bold). */
export function highlightParts(label: string, query: string): [string, boolean][] {
  const q = normalizeText(query);
  const bold = new Array<boolean>(label.length).fill(false);
  if (q) {
    const { text, from } = foldLabel(label);
    const mark = (start: number, length: number) => {
      for (let k = start; k < start + length && k < from.length; k++) bold[from[k]!] = true;
    };
    if (text.startsWith(q)) mark(0, q.length);
    else {
      for (const w of q.split(" ")) {
        const at = wordAt(text, w);
        const inside = at >= 0 ? at : text.indexOf(w);
        if (inside >= 0) mark(inside, w.length);
      }
    }
  }
  const parts: [string, boolean][] = [];
  for (let i = 0; i < label.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last[1] === bold[i]) last[0] += label[i];
    else parts.push([label[i]!, bold[i]!]);
  }
  return parts;
}

/** Before typing: real things to search for — the brands with the most
 * products, then the biggest categories and types. */
export function popularSuggestions(index: CuponeraSuggestion[]): CuponeraSuggestion[] {
  const top = (kind: CuponeraSuggestion["kind"], n: number) =>
    index
      .filter((s) => s.kind === kind)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, n);
  return [...top("marca", 3), ...top("categoria", 6)];
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
