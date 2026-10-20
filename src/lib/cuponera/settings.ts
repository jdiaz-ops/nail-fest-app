import type { CuponeraSettings } from "@prisma/client";
import { db } from "@/lib/db";

export const CUPONERA_SETTINGS_ID = "singleton";

export const CUPONERA_DEFAULT_TEXTS = {
  heroTitle: "Cuponera para manicuristas profesionales y estudiantes",
  heroLede: "Ahorra en tus compras de productos e insumos con la cuponera Nail Fest.",
  newTitle: "Lo nuevo de las marcas",
  newSubtitle: "Lo último que llegó a las tiendas, con el descuento de Nail Fest.",
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
  heroStyle: "marcas",
  categoryImages: {},
  newTitle: null,
  newSubtitle: null,
  newDays: 30,
  dealProductId: null,
  dealEndsAt: null,
  lastSyncAt: null,
  lastSyncOk: null,
  lastSyncError: null,
  lastSyncBrands: null,
  lastSyncProducts: null,
  creatorName: null,
  creatorSlug: null,
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
    | "newTitle"
    | "newSubtitle"
    | "newDays"
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
  /** Category key → picture URL ("Descubre por categoría"). */
  categoryImages?: Record<string, string>;
};

export async function updateCuponeraSettings(patch: CuponeraSettingsPatch): Promise<CuponeraSettings> {
  return db.cuponeraSettings.upsert({
    where: { id: CUPONERA_SETTINGS_ID },
    update: patch,
    create: { id: CUPONERA_SETTINGS_ID, ...patch },
  });
}
