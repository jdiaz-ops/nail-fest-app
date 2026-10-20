import type { CuponeraBrand, CuponeraProduct as ProductRow, CuponeraSettings } from "@prisma/client";
import { db } from "@/lib/db";
import { CUPONERA_DEFAULT_TEXTS, getCuponeraSettings } from "./settings";
import {
  CATEGORY_LOOK,
  formatPercent,
  isCategory,
  isProfession,
  priceWithCode,
  type CuponeraCategory,
  type CuponeraCoupon,
  type CuponeraProduct,
} from "./shared";

// What nailfest.lat/cuponera shows once Marcolini's catalog is in: the
// visible products of visible brands (both still coming in the sync), with
// Nail Fest's code applied to the price, plus the deal of the day, the brand
// coupons and what's new. null = nothing to show yet (the page falls back
// to the sample preview).

const DAY_MS = 86_400_000;
// Colombia has no DST: Bogotá is always UTC−5.
const BOGOTA_OFFSET_MS = 5 * 3_600_000;
const COUPON_TONES: CuponeraCoupon["tone"][] = ["pink", "teal", "peach"];
const NEW_LIMIT = 6;

export function bogotaDayIndex(now: Date): number {
  return Math.floor((now.getTime() - BOGOTA_OFFSET_MS) / DAY_MS);
}

export function nextBogotaMidnight(now: Date): Date {
  return new Date((bogotaDayIndex(now) + 1) * DAY_MS + BOGOTA_OFFSET_MS);
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });

export function effectiveCategory(row: Pick<ProductRow, "category" | "autoCategory">): CuponeraCategory | null {
  if (isCategory(row.category)) return row.category;
  return isCategory(row.autoCategory) ? row.autoCategory : null;
}

export function isNewProduct(row: Pick<ProductRow, "isNew" | "marcoliniCreatedAt">, newDays: number, now: Date): boolean {
  if (row.isNew !== null) return row.isNew;
  return now.getTime() - row.marcoliniCreatedAt.getTime() <= newDays * DAY_MS;
}

type Campaign = { name?: string; discountPercent?: number | null; endsAt?: string } | null;

function toCard(row: ProductRow, brand: CuponeraBrand): CuponeraProduct {
  const category = effectiveCategory(row);
  return {
    id: row.id,
    brand: brand.name,
    name: row.name,
    price: priceWithCode(row.price, Number(brand.discountPercent)),
    before: row.price,
    priceFrom: row.priceMax != null,
    code: brand.discountCode,
    imageUrl: row.imageUrl,
    ...CATEGORY_LOOK[category ?? "otro"],
    category,
    professions: row.professions.filter(isProfession),
    url: row.url,
  };
}

function toCoupon(brand: CuponeraBrand, index: number): CuponeraCoupon {
  const discount = Number(brand.discountPercent);
  const campaign = brand.campaign as Campaign;
  const defaults = [brand.codeAppliedByLink ? "Con el botón de la tienda el código se aplica solo" : "Escribe el código al pagar"];
  if (campaign?.discountPercent != null && campaign.endsAt) {
    defaults.unshift(`Descuento especial hasta el ${dateFormatter.format(new Date(campaign.endsAt))}`);
  }
  return {
    id: brand.id,
    brand: brand.name,
    initial: brand.name.trim().charAt(0).toUpperCase() || "·",
    logoUrl: brand.logoUrl,
    tone: COUPON_TONES[index % COUPON_TONES.length]!,
    title: brand.couponTitle?.trim() || `${formatPercent(discount)} de descuento`,
    code: brand.discountCode,
    conditions: brand.couponConditions.length > 0 ? brand.couponConditions : defaults,
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

export interface CuponeraView {
  settings: CuponeraSettings;
  texts: typeof CUPONERA_DEFAULT_TEXTS;
  products: CuponeraProduct[];
  deal: CuponeraDeal | null;
  coupons: CuponeraCoupon[];
  news: CuponeraProduct[];
}

export async function getCuponeraView(now: Date = new Date()): Promise<CuponeraView | null> {
  const [settings, brands] = await Promise.all([
    getCuponeraSettings(),
    db.cuponeraBrand.findMany({
      where: { visible: true, available: true },
      orderBy: { order: "asc" },
      include: { products: { where: { visible: true, available: true }, orderBy: { marcoliniCreatedAt: "desc" } } },
    }),
  ]);

  const rows = brands.flatMap((brand) => brand.products.map((row) => ({ row, brand })));
  if (rows.length === 0) return null;

  // Featured first; then the brands in the admin's order, newest first.
  const ordered = [...rows.filter((r) => r.row.featured), ...rows.filter((r) => !r.row.featured)];
  const cards = new Map(ordered.map(({ row, brand }) => [row.id, toCard(row, brand)]));
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

  const news = settings.showNew
    ? rows
        .filter(({ row }) => isNewProduct(row, settings.newDays, now))
        .sort((a, b) => b.row.marcoliniCreatedAt.getTime() - a.row.marcoliniCreatedAt.getTime())
        .slice(0, NEW_LIMIT)
        .map(({ row }) => cards.get(row.id)!)
    : [];

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
  };
}
