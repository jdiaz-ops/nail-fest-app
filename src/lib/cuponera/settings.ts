import type { CuponeraSettings } from "@prisma/client";
import { db } from "@/lib/db";

export const CUPONERA_SETTINGS_ID = "singleton";

export const CUPONERA_DEFAULT_TEXTS = {
  heroTitle: "Ahorra todo el año en productos e insumos.",
  heroLede: "Para manicuristas profesionales, estudiantes y educadoras.",
  panelTitle: "Descuentos de las marcas",
  categoriesTitle: "Explora ahorros por categoría",
  bestsellersTitle: "Lo más comprado por la comunidad",
  bestsellersSubtitle: "Con los códigos de Nail Fest, últimos 90 días",
  newTitle: "Lo nuevo de las marcas",
  // Crossed out by the client on 2026-10-20, like the one under "Todas las marcas".
  newSubtitle: "",
  allBrandsTitle: "Todas las marcas",
  // Crossed out by the client on 2026-10-20: no text under "Todas las
  // marcas" unless the admin writes one.
  allBrandsSubtitle: "",
};

// What a fresh install reads before anyone saves anything — same "a missing
// row is just the defaults" reasoning as getOrgSettings(). Reading never
// writes; the row is created on the first save or sync.
const DEFAULTS: CuponeraSettings = {
  id: CUPONERA_SETTINGS_ID,
  published: false,
  heroTitle: null,
  heroLede: null,
  showDeal: true,
  showCoupons: true,
  showNew: true,
  showBestsellers: true,
  heroStyle: "cupones",
  panelTitle: null,
  categoryImages: {},
  showCategories: true,
  categoriesTitle: null,
  bestsellersTitle: null,
  bestsellersSubtitle: null,
  newTitle: null,
  newSubtitle: null,
  newDays: 30,
  showAllBrands: true,
  allBrandsTitle: null,
  allBrandsSubtitle: null,
  dealProductId: null,
  dealEndsAt: null,
  lastSyncAt: null,
  lastSyncOk: null,
  lastSyncError: null,
  lastSyncBrands: null,
  lastSyncProducts: null,
  creatorName: null,
  creatorSlug: null,
  syncLockUntil: null,
  updatedAt: new Date(0),
};

export async function getCuponeraSettings(): Promise<CuponeraSettings> {
  return (await db.cuponeraSettings.findUnique({ where: { id: CUPONERA_SETTINGS_ID } })) ?? DEFAULTS;
}

export type CuponeraSettingsPatch = Partial<
  Pick<
    CuponeraSettings,
    | "published"
    | "heroTitle"
    | "heroLede"
    | "showDeal"
    | "showCoupons"
    | "showNew"
    | "showBestsellers"
    | "heroStyle"
    | "panelTitle"
    | "showCategories"
    | "categoriesTitle"
    | "bestsellersTitle"
    | "bestsellersSubtitle"
    | "newTitle"
    | "newSubtitle"
    | "newDays"
    | "showAllBrands"
    | "allBrandsTitle"
    | "allBrandsSubtitle"
    | "dealProductId"
    | "dealEndsAt"
    | "lastSyncAt"
    | "lastSyncOk"
    | "lastSyncError"
    | "lastSyncBrands"
    | "lastSyncProducts"
    | "creatorName"
    | "creatorSlug"
  >
> & {
  /** Category key → picture URL ("Explora ahorros por categoría"). */
  categoryImages?: Record<string, string>;
};

export async function updateCuponeraSettings(patch: CuponeraSettingsPatch): Promise<CuponeraSettings> {
  return db.cuponeraSettings.upsert({
    where: { id: CUPONERA_SETTINGS_ID },
    update: patch,
    create: { id: CUPONERA_SETTINGS_ID, ...patch },
  });
}
