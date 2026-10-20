import { db } from "@/lib/db";
import { getCollectionMappings, resolveCategory, type ResolvedCategory } from "./data";
import { classifyProduct, collectionKey, isCategory, isProfession, isSubcategoryOf, type CuponeraCategory, type CuponeraProfession } from "./shared";

// Reads and writes behind /admin/cuponera ("Editar cuponera"). Only the
// curation fields — what comes from Marcolini is the sync's (lib/cuponera/sync.ts).

export interface AdminCuponeraBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  storeUrl: string | null;
  storeKind: string;
  codeAppliedByLink: boolean;
  discountCode: string;
  discountPercent: number;
  commissionPercent: number;
  campaignName: string | null;
  freeShippingFrom: number | null;
  freeShippingAllZones: boolean;
  available: boolean;
  visible: boolean;
  showCoupon: boolean;
  couponTitle: string | null;
  couponConditions: string[];
  couponExclusive: boolean;
  productCount: number;
  visibleProductCount: number;
}

export interface AdminCuponeraProduct {
  id: string;
  brandId: string;
  brandName: string;
  /** Hiding the brand hides all its products, whatever their own switch says. */
  brandVisible: boolean;
  name: string;
  imageUrl: string | null;
  price: number;
  priceFrom: boolean;
  priceWithCode: number;
  url: string;
  available: boolean;
  visible: boolean;
  featured: boolean;
  /** The admin's pick for this product (null = automatic). */
  category: CuponeraCategory | null;
  subcategory: string | null;
  /** What the page uses, and where it came from. */
  resolved: ResolvedCategory;
  /** What it would get without the admin's pick (collection or guess). */
  automatic: ResolvedCategory;
  /** The sync's guess, shown as "Automática (…)". */
  autoCategory: CuponeraCategory | null;
  autoSubcategory: string | null;
  collections: string[];
  /** The store's own category, for the subcategory inside a picked category. */
  sourceCategory: string | null;
  colorFamily: string | null;
  size: string | null;
  line: string | null;
  variant: string | null;
  variantCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  unitsLeft: number | null;
  soldWithCode: number;
  professions: CuponeraProfession[];
  isNew: boolean | null;
  marcoliniCreatedAt: string;
}

/** One row of the unifier: every brand collection with the same
 * normalized name, whoever wrote it and however. */
export interface AdminCollectionRow {
  key: string;
  /** The most used spelling. */
  label: string;
  /** Other spellings of the same collection. */
  otherNames: string[];
  brands: string[];
  productCount: number;
  suggestion: { category: CuponeraCategory | null; subcategory: string | null };
  mapping: { category: CuponeraCategory | null; subcategory: string | null; ignored: boolean } | null;
  /** Products whose own name points to another category than the one the
   * collection has (or would get): a broad "Geles" holding a builder gel. */
  conflicts: { name: string; category: CuponeraCategory }[];
}

export async function getCuponeraAdminData(): Promise<{
  brands: AdminCuponeraBrand[];
  products: AdminCuponeraProduct[];
  collections: AdminCollectionRow[];
}> {
  const [brands, mappings] = await Promise.all([
    db.cuponeraBrand.findMany({
      orderBy: [{ available: "desc" }, { order: "asc" }],
      include: { products: { orderBy: [{ featured: "desc" }, { name: "asc" }] } },
    }),
    getCollectionMappings(),
  ]);

  const products: AdminCuponeraProduct[] = brands.flatMap((b) =>
    b.products.map((p) => {
      const discount = Number(b.discountPercent);
      return {
        id: p.id,
        brandId: b.id,
        brandName: b.name,
        brandVisible: b.visible,
        name: p.name,
        imageUrl: p.imageUrl,
        price: p.price,
        priceFrom: p.priceMax != null,
        priceWithCode: discount > 0 ? Math.round(p.price * (1 - discount / 100)) : p.price,
        url: p.url,
        available: p.available && b.available,
        visible: p.visible,
        featured: p.featured,
        category: isCategory(p.category) ? p.category : null,
        subcategory: isCategory(p.category) && isSubcategoryOf(p.category, p.subcategory) ? p.subcategory : null,
        resolved: resolveCategory(p, mappings),
        automatic: resolveCategory({ ...p, category: null, subcategory: null }, mappings),
        autoCategory: isCategory(p.autoCategory) ? p.autoCategory : null,
        autoSubcategory: isCategory(p.autoCategory) && isSubcategoryOf(p.autoCategory, p.autoSubcategory) ? p.autoSubcategory : null,
        collections: p.collections,
        sourceCategory: p.sourceCategory,
        colorFamily: p.colorFamily,
        size: p.size,
        line: p.line,
        variant: p.variant,
        variantCount: p.variantCount,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        unitsLeft: p.unitsLeft,
        soldWithCode: p.soldWithCode,
        professions: p.professions.filter(isProfession),
        isNew: p.isNew,
        marcoliniCreatedAt: p.marcoliniCreatedAt.toISOString(),
      };
    }),
  );

  // The unifier: collections of products still coming from Marcolini.
  const byKey = new Map<string, { names: Map<string, number>; brands: Set<string>; products: Map<string, string> }>();
  for (const p of products) {
    if (!p.available) continue;
    for (const name of p.collections) {
      const key = collectionKey(name);
      if (!key) continue;
      const row = byKey.get(key) ?? { names: new Map(), brands: new Set(), products: new Map() };
      row.names.set(name, (row.names.get(name) ?? 0) + 1);
      row.brands.add(p.brandName);
      row.products.set(p.id, p.name);
      byKey.set(key, row);
    }
  }
  const collections: AdminCollectionRow[] = [...byKey.entries()].map(([key, row]) => {
    const names = [...row.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([n]) => n);
    const stored = mappings.get(key);
    const mapping = stored
      ? {
          category: isCategory(stored.category) ? stored.category : null,
          subcategory: isCategory(stored.category) && isSubcategoryOf(stored.category, stored.subcategory) ? stored.subcategory : null,
          ignored: stored.ignored,
        }
      : null;
    const guess = classifyProduct({ name: names.join(" ") });
    const target = mapping ? (mapping.ignored ? null : mapping.category) : guess.category;
    const conflicts = target
      ? [...row.products.values()]
          .map((name) => ({ name, category: classifyProduct({ name }).category }))
          .filter((c): c is { name: string; category: CuponeraCategory } => c.category !== null && c.category !== target)
      : [];
    return {
      key,
      label: names[0]!,
      otherNames: names.slice(1),
      brands: [...row.brands].sort((a, b) => a.localeCompare(b, "es")),
      productCount: row.products.size,
      suggestion: guess,
      mapping,
      conflicts,
    };
  });
  // Pending ones first (what still needs a decision), then by size.
  collections.sort((a, b) => Number(a.mapping !== null) - Number(b.mapping !== null) || b.productCount - a.productCount || a.label.localeCompare(b.label, "es"));

  return {
    brands: brands.map((b) => {
      const campaign = b.campaign as { name?: string } | null;
      return {
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl,
        storeUrl: b.storeUrl,
        storeKind: b.storeKind,
        codeAppliedByLink: b.codeAppliedByLink,
        discountCode: b.discountCode,
        discountPercent: Number(b.discountPercent),
        commissionPercent: Number(b.commissionPercent),
        campaignName: campaign?.name ?? null,
        freeShippingFrom: b.freeShippingFrom,
        freeShippingAllZones: b.freeShippingAllZones,
        available: b.available,
        visible: b.visible,
        showCoupon: b.showCoupon,
        couponTitle: b.couponTitle,
        couponConditions: b.couponConditions,
        couponExclusive: b.couponExclusive,
        productCount: b.products.filter((p) => p.available).length,
        visibleProductCount: b.products.filter((p) => p.available && p.visible).length,
      };
    }),
    products,
    collections,
  };
}

export async function updateCuponeraBrand(
  id: string,
  patch: { visible?: boolean; showCoupon?: boolean; couponTitle?: string | null; couponConditions?: string[]; couponExclusive?: boolean },
) {
  return db.cuponeraBrand.update({ where: { id }, data: patch });
}

// Same pairwise order swap as lib/linkPage.ts's moveLink(), among the
// brands still coming from Marcolini (the gone ones sit at the bottom).
export async function moveCuponeraBrand(id: string, direction: "up" | "down"): Promise<void> {
  const brands = await db.cuponeraBrand.findMany({ where: { available: true }, orderBy: { order: "asc" } });
  const idx = brands.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("not_found");
  const other = brands[direction === "up" ? idx - 1 : idx + 1];
  const current = brands[idx];
  if (!other || !current) return;
  // Equal orders (two brands added in the same sync can't, but old data
  // might) would make the swap a no-op — renumber first.
  if (other.order === current.order) {
    await db.$transaction(brands.map((b, i) => db.cuponeraBrand.update({ where: { id: b.id }, data: { order: i } })));
    return moveCuponeraBrand(id, direction);
  }
  await db.$transaction([
    db.cuponeraBrand.update({ where: { id: current.id }, data: { order: other.order } }),
    db.cuponeraBrand.update({ where: { id: other.id }, data: { order: current.order } }),
  ]);
}

export type CuponeraProductPatch = {
  visible?: boolean;
  featured?: boolean;
  category?: CuponeraCategory | null;
  subcategory?: string | null;
  professions?: CuponeraProfession[];
  isNew?: boolean | null;
};

export async function updateCuponeraProducts(ids: string[], patch: CuponeraProductPatch): Promise<number> {
  const result = await db.cuponeraProduct.updateMany({ where: { id: { in: ids } }, data: patch });
  return result.count;
}

/** Map a collection once (or ignore it); null removes the mapping and the
 * collection goes back to "pendiente". */
export async function saveCollectionMapping(
  key: string,
  label: string,
  value: { category: CuponeraCategory | null; subcategory: string | null; ignored: boolean } | null,
): Promise<void> {
  if (!value) {
    await db.cuponeraCollectionMap.deleteMany({ where: { key } });
    return;
  }
  const data = {
    label,
    category: value.ignored ? null : value.category,
    subcategory: !value.ignored && value.category && isSubcategoryOf(value.category, value.subcategory) ? value.subcategory : null,
    ignored: value.ignored,
  };
  await db.cuponeraCollectionMap.upsert({ where: { key }, update: data, create: { key, ...data } });
}
