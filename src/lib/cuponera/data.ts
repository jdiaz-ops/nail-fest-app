import type { CuponeraBrand, CuponeraCollectionMap, CuponeraProduct as ProductRow, CuponeraSettings } from "@prisma/client";
import { db } from "@/lib/db";
import { CUPONERA_DEFAULT_TEXTS, getCuponeraSettings } from "./settings";
import { groupByLine, sortTiles, type CuponeraTile } from "./browse";
import {
  collectionKey,
  formatCop,
  formatPercent,
  isCategory,
  isProfession,
  isSubcategoryOf,
  lookFor,
  normalizeText,
  priceWithCode,
  subcategoryWithin,
  variantsLabelOf,
  type CuponeraCategory,
  type CuponeraCoupon,
  type CuponeraProduct,
} from "./shared";

// What nailfest.lat/cuponera shows once Marcolini's catalog is in: the
// visible products of visible brands (both still coming in the sync), with
// Nail Fest's code applied to the price, plus the deal of the day, the brand
// coupons, what's new and what the community buys most. null = nothing to
// show yet (the page falls back to the sample preview).

const DAY_MS = 86_400_000;
// Colombia has no DST: Bogotá is always UTC−5.
const BOGOTA_OFFSET_MS = 5 * 3_600_000;
const COUPON_TONES: CuponeraCoupon["tone"][] = ["pink", "teal", "peach"];
const NEW_LIMIT = 6;
const BESTSELLERS_LIMIT = 8;
// Fewer than this many products sold with the code isn't a ranking yet.
const BESTSELLERS_MIN = 3;

export function bogotaDayIndex(now: Date): number {
  return Math.floor((now.getTime() - BOGOTA_OFFSET_MS) / DAY_MS);
}

export function nextBogotaMidnight(now: Date): Date {
  return new Date((bogotaDayIndex(now) + 1) * DAY_MS + BOGOTA_OFFSET_MS);
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });

export type CollectionMapping = Pick<CuponeraCollectionMap, "category" | "subcategory" | "ignored">;

export interface ResolvedCategory {
  category: CuponeraCategory | null;
  subcategory: string | null;
  /** Where it came from: the admin's pick for this product, a mapped
   * collection, or the sync's guess. */
  source: "manual" | "coleccion" | "auto" | null;
}

/** A product's category, in order of trust: the admin's pick for it, the
 * first of its collections mapped in the unifier, the sync's guess. A
 * subcategory only counts if it belongs to the category it came with; a
 * category picked or mapped without one gets the one the product's own
 * words give inside it (a file in "Herramientas" is still a file). */
export function resolveCategory(
  row: Pick<ProductRow, "name" | "line" | "sourceCategory" | "collections" | "category" | "subcategory" | "autoCategory" | "autoSubcategory">,
  mappings: Map<string, CollectionMapping>,
): ResolvedCategory {
  if (isCategory(row.category)) {
    const sub = isSubcategoryOf(row.category, row.subcategory) ? row.subcategory : subcategoryWithin(row.category, row);
    return { category: row.category, subcategory: sub, source: "manual" };
  }
  for (const name of row.collections) {
    const mapping = mappings.get(collectionKey(name));
    if (mapping && !mapping.ignored && isCategory(mapping.category)) {
      const sub = isSubcategoryOf(mapping.category, mapping.subcategory) ? mapping.subcategory : subcategoryWithin(mapping.category, row);
      return { category: mapping.category, subcategory: sub, source: "coleccion" };
    }
  }
  if (isCategory(row.autoCategory)) {
    return { category: row.autoCategory, subcategory: isSubcategoryOf(row.autoCategory, row.autoSubcategory) ? row.autoSubcategory : null, source: "auto" };
  }
  return { category: null, subcategory: null, source: null };
}

export async function getCollectionMappings(): Promise<Map<string, CollectionMapping>> {
  const rows = await db.cuponeraCollectionMap.findMany({ select: { key: true, category: true, subcategory: true, ignored: true } });
  return new Map(rows.map((r) => [r.key, r]));
}

export function isNewProduct(row: Pick<ProductRow, "isNew" | "marcoliniCreatedAt">, newDays: number, now: Date): boolean {
  if (row.isNew !== null) return row.isNew;
  return now.getTime() - row.marcoliniCreatedAt.getTime() <= newDays * DAY_MS;
}

type Campaign = { name?: string; discountPercent?: number | null; endsAt?: string } | null;

function toCard(row: ProductRow, brand: CuponeraBrand, mappings: Map<string, CollectionMapping>): CuponeraProduct {
  const { category, subcategory } = resolveCategory(row, mappings);
  return {
    id: row.id,
    brand: brand.name,
    name: row.name,
    price: priceWithCode(row.price, Number(brand.discountPercent)),
    before: row.price,
    priceFrom: row.priceMax != null,
    code: brand.discountCode,
    imageUrl: row.imageUrl,
    ...lookFor(category, subcategory),
    category,
    subcategory,
    professions: row.professions.filter(isProfession),
    url: row.url,
    colorFamily: row.colorFamily,
    size: row.size,
    line: row.line,
    variant: row.variant,
    variantCount: row.variantCount,
    variantsLabel: variantsLabelOf(row.variantCount, row.optionNames, category),
    rating: row.ratingAverage != null && row.ratingCount > 0 ? { average: row.ratingAverage, count: row.ratingCount } : null,
    unitsLeft: row.unitsLeft,
    soldWithCode: row.soldWithCode,
    description: row.description ? row.description.slice(0, 200) : null,
  };
}

/** "Envío gratis desde $120.000" — from the brand's shipping zones in
 * Marcolini; "en algunas zonas" when it doesn't hold everywhere. */
export function freeShippingLine(brand: Pick<CuponeraBrand, "freeShippingFrom" | "freeShippingAllZones">): string | null {
  if (brand.freeShippingFrom == null) return null;
  const where = brand.freeShippingAllZones ? "" : " en algunas zonas";
  return brand.freeShippingFrom === 0 ? `Envío gratis${where}` : `Envío gratis desde ${formatCop(brand.freeShippingFrom)}${where}`;
}

export function defaultCouponConditions(brand: CuponeraBrand): string[] {
  const campaign = brand.campaign as Campaign;
  const conditions = [brand.codeAppliedByLink ? "Con el botón de la tienda el código se aplica solo" : "Escribe el código al pagar"];
  const shipping = freeShippingLine(brand);
  if (shipping) conditions.push(shipping);
  if (campaign?.discountPercent != null && campaign.endsAt) {
    conditions.unshift(`Descuento especial hasta el ${dateFormatter.format(new Date(campaign.endsAt))}`);
  }
  return conditions;
}

function toCoupon(brand: CuponeraBrand, index: number): CuponeraCoupon {
  const discount = Number(brand.discountPercent);
  return {
    id: brand.id,
    brand: brand.name,
    initial: brand.name.trim().charAt(0).toUpperCase() || "·",
    logoUrl: brand.logoUrl,
    tone: COUPON_TONES[index % COUPON_TONES.length]!,
    title: brand.couponTitle?.trim() || `${formatPercent(discount)} de descuento`,
    code: brand.discountCode,
    conditions: brand.couponConditions.length > 0 ? brand.couponConditions : defaultCouponConditions(brand),
    exclusive: brand.couponExclusive,
    url: brand.storeUrl,
  };
}

export interface CuponeraDeal {
  product: CuponeraProduct;
  /** When it changes: midnight for the automatic daily one, the admin's
   * end for a pinned one; null = pinned with no end (no countdown). */
  endsAt: Date | null;
}

export interface CuponeraNewItem {
  product: CuponeraProduct;
  /** Other new products of the same line (one card per line). */
  moreInLine: number;
}

export interface CuponeraView {
  settings: CuponeraSettings;
  texts: typeof CUPONERA_DEFAULT_TEXTS;
  products: CuponeraProduct[];
  deal: CuponeraDeal | null;
  coupons: CuponeraCoupon[];
  news: CuponeraNewItem[];
  /** Most bought with Nail Fest's codes, first to last; the tones of a line
   * count together, in one card. */
  bestsellers: CuponeraTile[];
}

export async function getCuponeraView(now: Date = new Date()): Promise<CuponeraView | null> {
  const [settings, brands, mappings] = await Promise.all([
    getCuponeraSettings(),
    db.cuponeraBrand.findMany({
      where: { visible: true, available: true },
      orderBy: { order: "asc" },
      include: { products: { where: { visible: true, available: true }, orderBy: { marcoliniCreatedAt: "desc" } } },
    }),
    getCollectionMappings(),
  ]);

  const rows = brands.flatMap((brand) => brand.products.map((row) => ({ row, brand })));
  if (rows.length === 0) return null;

  // Featured first; then the brands in the admin's order, newest first.
  const ordered = [...rows.filter((r) => r.row.featured), ...rows.filter((r) => !r.row.featured)];
  const cards = new Map(ordered.map(({ row, brand }) => [row.id, toCard(row, brand, mappings)]));
  const products = [...cards.values()];

  let deal: CuponeraDeal | null = null;
  if (settings.showDeal) {
    const pinned = settings.dealProductId ? cards.get(settings.dealProductId) : undefined;
    if (pinned && (!settings.dealEndsAt || settings.dealEndsAt > now)) {
      deal = { product: pinned, endsAt: settings.dealEndsAt };
    } else {
      // Automatic: a different product every day (Bogotá time) among the
      // featured ones — or, with none featured, among everything discounted.
      const featured = ordered.filter((r) => r.row.featured).map((r) => cards.get(r.row.id)!);
      const pool = (featured.length > 0 ? featured : products).filter((p) => p.price < p.before).sort((a, b) => a.id.localeCompare(b.id));
      if (pool.length > 0) deal = { product: pool[bogotaDayIndex(now) % pool.length]!, endsAt: nextBogotaMidnight(now) };
    }
  }

  const coupons = settings.showCoupons ? brands.filter((b) => b.showCoupon).map(toCoupon) : [];

  // Newest first, one card per line: a brand launching 12 tones at once
  // shows its newest one and "y 11 tonos más", not twelve cards.
  const news: CuponeraNewItem[] = [];
  if (settings.showNew) {
    const byLine = new Map<string, CuponeraNewItem>();
    const fresh = rows
      .filter(({ row }) => isNewProduct(row, settings.newDays, now))
      .sort((a, b) => b.row.marcoliniCreatedAt.getTime() - a.row.marcoliniCreatedAt.getTime());
    for (const { row, brand } of fresh) {
      const line = row.line?.trim();
      const key = line ? `${brand.id}|${normalizeText(line)}` : row.id;
      const seen = byLine.get(key);
      if (seen) {
        seen.moreInLine += 1;
        continue;
      }
      const item = { product: cards.get(row.id)!, moreInLine: 0 };
      byLine.set(key, item);
      news.push(item);
    }
    news.splice(NEW_LIMIT);
  }

  const sold = products.filter((p) => p.soldWithCode > 0).sort((a, b) => b.soldWithCode - a.soldWithCode);
  const soldTiles = sortTiles(groupByLine(sold), "vendidos").slice(0, BESTSELLERS_LIMIT);
  const bestsellers = settings.showBestsellers && soldTiles.length >= BESTSELLERS_MIN ? soldTiles : [];

  return {
    settings,
    texts: {
      heroTitle: settings.heroTitle?.trim() || CUPONERA_DEFAULT_TEXTS.heroTitle,
      heroLede: settings.heroLede?.trim() || CUPONERA_DEFAULT_TEXTS.heroLede,
      newTitle: settings.newTitle?.trim() || CUPONERA_DEFAULT_TEXTS.newTitle,
      newSubtitle: settings.newSubtitle?.trim() || CUPONERA_DEFAULT_TEXTS.newSubtitle,
    },
    products,
    deal,
    coupons,
    news,
    bestsellers,
  };
}
