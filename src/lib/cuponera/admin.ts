import { db } from "@/lib/db";
import { effectiveCategory } from "./data";
import { isCategory, isProfession, type CuponeraCategory, type CuponeraProfession } from "./shared";

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
  /** The admin's pick (null = automatic). */
  category: CuponeraCategory | null;
  /** The sync's guess from the name and Marcolini's hints. */
  autoCategory: CuponeraCategory | null;
  /** What the page uses: the pick, or the guess. */
  effectiveCategory: CuponeraCategory | null;
  professions: CuponeraProfession[];
  isNew: boolean | null;
  marcoliniCreatedAt: string;
}

export async function getCuponeraAdminData(): Promise<{ brands: AdminCuponeraBrand[]; products: AdminCuponeraProduct[] }> {
  const brands = await db.cuponeraBrand.findMany({
    orderBy: [{ available: "desc" }, { order: "asc" }],
    include: { products: { orderBy: [{ featured: "desc" }, { name: "asc" }] } },
  });

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
    products: brands.flatMap((b) =>
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
          autoCategory: isCategory(p.autoCategory) ? p.autoCategory : null,
          effectiveCategory: effectiveCategory(p),
          professions: p.professions.filter(isProfession),
          isNew: p.isNew,
          marcoliniCreatedAt: p.marcoliniCreatedAt.toISOString(),
        };
      }),
    ),
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
  professions?: CuponeraProfession[];
  isNew?: boolean | null;
};

export async function updateCuponeraProducts(ids: string[], patch: CuponeraProductPatch): Promise<number> {
  const result = await db.cuponeraProduct.updateMany({ where: { id: { in: ids } }, data: patch });
  return result.count;
}
