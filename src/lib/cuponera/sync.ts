import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchMarcoliniCatalog, marcoliniConfig, MarcoliniError, type MarcoliniProduct } from "./marcolini";
import { guessCategory } from "./shared";
import { updateCuponeraSettings } from "./settings";

// Copies Nail Fest's Marcolini catalog into CuponeraBrand/CuponeraProduct.
// Runs from "Sincronizar ahora" in /admin/cuponera and once a day from the
// cron (/api/cuponera/sync). Only the fields that come from Marcolini are
// written; the admin's curation (visible, order, category, professions,
// coupon texts…) is never touched. A brand or product that stops coming is
// marked unavailable, never deleted — its curation is still there if it
// comes back. Never sends anything to anyone.

export const NOT_CONFIGURED_MESSAGE =
  "Falta la llave de Marcolini: agrega MARCOLINI_API_KEY en Vercel (Settings → Environment Variables) y vuelve a desplegar.";

export type CuponeraSyncResult =
  | {
      ok: true;
      brands: number;
      products: number;
      brandsAdded: number;
      productsAdded: number;
      productsUpdated: number;
      productsGone: number;
      skipped: number;
      servedFrom: string;
    }
  | { ok: false; error: string };

type SyncedProductFields = {
  brandId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  priceMax: number | null;
  compareAtPrice: number | null;
  url: string;
  sourceCategory: string | null;
  collections: string[];
  type: string;
  available: boolean;
  marcoliniCreatedAt: Date;
  autoCategory: string | null;
};

function syncedProductFields(product: MarcoliniProduct, brandId: string): SyncedProductFields {
  const whole = (value: number | null) => (value == null ? null : Math.round(value));
  return {
    brandId,
    name: product.name,
    imageUrl: product.imageUrl,
    price: Math.round(product.price),
    priceMax: whole(product.priceMax),
    compareAtPrice: whole(product.compareAtPrice),
    url: product.url,
    sourceCategory: product.category,
    collections: product.collections,
    type: product.type,
    available: true,
    marcoliniCreatedAt: new Date(product.createdAt),
    autoCategory: guessCategory(product.name, [product.category, ...product.collections]),
  };
}

function sameProduct(current: SyncedProductFields, next: SyncedProductFields): boolean {
  return (
    current.brandId === next.brandId &&
    current.name === next.name &&
    current.imageUrl === next.imageUrl &&
    current.price === next.price &&
    current.priceMax === next.priceMax &&
    current.compareAtPrice === next.compareAtPrice &&
    current.url === next.url &&
    current.sourceCategory === next.sourceCategory &&
    current.collections.join("\n") === next.collections.join("\n") &&
    current.type === next.type &&
    current.available === next.available &&
    current.marcoliniCreatedAt.getTime() === next.marcoliniCreatedAt.getTime() &&
    current.autoCategory === next.autoCategory
  );
}

async function recordFailure(error: string, now: Date): Promise<CuponeraSyncResult> {
  await updateCuponeraSettings({ lastSyncAt: now, lastSyncOk: false, lastSyncError: error });
  return { ok: false, error };
}

export async function syncCuponera(options: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<CuponeraSyncResult> {
  const now = options.now ?? new Date();
  const config = marcoliniConfig();
  if (!config) return recordFailure(NOT_CONFIGURED_MESSAGE, now);

  let catalog;
  try {
    catalog = await fetchMarcoliniCatalog(config, options.fetchImpl);
  } catch (err) {
    if (err instanceof MarcoliniError) return recordFailure(err.message, now);
    console.error("cuponera sync: unexpected error reading Marcolini", err);
    return recordFailure("No se pudo leer el catálogo de Marcolini por un error inesperado. Vuelve a intentarlo.", now);
  }

  // Brands — a handful, one upsert each. A new brand starts the way Nail
  // Fest has it in its Marcolini vitrina (shown or hidden), at the end.
  const brandIdByMarcolini = new Map(
    (await db.cuponeraBrand.findMany({ select: { id: true, marcoliniId: true } })).map((b) => [b.marcoliniId, b.id]),
  );
  let lastOrder = (await db.cuponeraBrand.aggregate({ _max: { order: true } }))._max.order ?? -1;
  let brandsAdded = 0;
  for (const brand of catalog.brands) {
    const synced = {
      name: brand.name,
      logoUrl: brand.logoUrl,
      storeUrl: brand.storeUrl,
      storeKind: brand.storeKind,
      codeAppliedByLink: brand.codeAppliedByLink,
      discountCode: brand.discountCode,
      discountPercent: brand.discountPercent,
      commissionPercent: brand.commissionPercent,
      campaign: brand.campaign ?? Prisma.DbNull,
      available: true,
      lastSyncedAt: now,
    };
    const isNew = !brandIdByMarcolini.has(brand.id);
    const row = await db.cuponeraBrand.upsert({
      where: { marcoliniId: brand.id },
      update: synced,
      create: { marcoliniId: brand.id, ...synced, visible: brand.visibleInVitrina, order: isNew ? ++lastOrder : 0 },
      select: { id: true },
    });
    brandIdByMarcolini.set(brand.id, row.id);
    if (isNew) brandsAdded++;
  }
  await db.cuponeraBrand.updateMany({
    where: { marcoliniId: { notIn: catalog.brands.map((b) => b.id) }, available: true },
    data: { available: false },
  });

  // Products — possibly thousands: new ones in one createMany, and only the
  // ones that actually changed get an update.
  const existing = new Map(
    (
      await db.cuponeraProduct.findMany({
        select: {
          id: true,
          marcoliniId: true,
          brandId: true,
          name: true,
          imageUrl: true,
          price: true,
          priceMax: true,
          compareAtPrice: true,
          url: true,
          sourceCategory: true,
          collections: true,
          type: true,
          available: true,
          marcoliniCreatedAt: true,
          autoCategory: true,
        },
      })
    ).map((p) => [p.marcoliniId, p]),
  );

  const toCreate: Prisma.CuponeraProductCreateManyInput[] = [];
  const toUpdate: { id: string; data: SyncedProductFields }[] = [];
  for (const product of catalog.products) {
    const brandId = brandIdByMarcolini.get(product.brandId);
    if (!brandId) continue;
    const next = syncedProductFields(product, brandId);
    const current = existing.get(product.id);
    if (!current) toCreate.push({ marcoliniId: product.id, ...next, lastSyncedAt: now });
    else if (!sameProduct(current, next)) toUpdate.push({ id: current.id, data: next });
  }

  if (toCreate.length > 0) await db.cuponeraProduct.createMany({ data: toCreate, skipDuplicates: true });
  for (let i = 0; i < toUpdate.length; i += 50) {
    await db.$transaction(
      toUpdate.slice(i, i + 50).map((u) => db.cuponeraProduct.update({ where: { id: u.id }, data: { ...u.data, lastSyncedAt: now } })),
    );
  }
  const gone = await db.cuponeraProduct.updateMany({
    where: { marcoliniId: { notIn: catalog.products.map((p) => p.id) }, available: true },
    data: { available: false },
  });

  await updateCuponeraSettings({
    lastSyncAt: now,
    lastSyncOk: true,
    lastSyncError: null,
    lastSyncBrands: catalog.brands.length,
    lastSyncProducts: catalog.products.length,
    creatorName: catalog.creator.displayName,
    creatorSlug: catalog.creator.storefrontSlug,
  });

  return {
    ok: true,
    brands: catalog.brands.length,
    products: catalog.products.length,
    brandsAdded,
    productsAdded: toCreate.length,
    productsUpdated: toUpdate.length,
    productsGone: gone.count,
    skipped: catalog.skipped,
    servedFrom: catalog.servedFrom,
  };
}
