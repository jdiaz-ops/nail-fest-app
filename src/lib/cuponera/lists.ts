import type { CuponeraList } from "@prisma/client";
import { db } from "@/lib/db";
import { isCategory, isSubcategoryOf, normalizeText, type CuponeraCategory } from "./shared";

// The front page's lists (CuponeraList), edited in /admin/cuponera: a
// category fills itself from the catalog ("Esmaltes semipermanentes");
// chosen products keep the admin's order ("Para empezar en acrílico").

export type CuponeraListKind = "category" | "products";

export const MAX_LIST_PRODUCTS = 40;

export interface CuponeraListInput {
  title: string;
  subtitle: string | null;
  kind: CuponeraListKind;
  category: CuponeraCategory | null;
  subcategory: string | null;
  productIds: string[];
}

export function listSlug(title: string): string {
  return normalizeText(title).replace(/ /g, "-").slice(0, 60).replace(/-+$/, "") || "lista";
}

async function freeSlug(title: string): Promise<string> {
  const base = listSlug(title);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.cuponeraList.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
}

// What a list keeps: a category list no products, a products list no
// category; a subcategory only inside its category.
function listData(input: CuponeraListInput) {
  const category = input.kind === "category" && isCategory(input.category) ? input.category : null;
  return {
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    kind: input.kind,
    category,
    subcategory: category && isSubcategoryOf(category, input.subcategory) ? input.subcategory : null,
    productIds: input.kind === "products" ? [...new Set(input.productIds)].slice(0, MAX_LIST_PRODUCTS) : [],
  };
}

export async function getCuponeraLists(): Promise<CuponeraList[]> {
  return db.cuponeraList.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

/** New lists go last. The slug (its page's address) never changes after. */
export async function createCuponeraList(input: CuponeraListInput): Promise<CuponeraList> {
  const last = await db.cuponeraList.aggregate({ _max: { position: true } });
  return db.cuponeraList.create({
    data: { ...listData(input), slug: await freeSlug(input.title), position: (last._max.position ?? -1) + 1 },
  });
}

export async function updateCuponeraList(id: string, input: CuponeraListInput & { visible: boolean }): Promise<CuponeraList> {
  return db.cuponeraList.update({ where: { id }, data: { ...listData(input), visible: input.visible } });
}

export async function setCuponeraListVisible(id: string, visible: boolean): Promise<CuponeraList> {
  return db.cuponeraList.update({ where: { id }, data: { visible } });
}

export async function deleteCuponeraList(id: string): Promise<void> {
  await db.cuponeraList.delete({ where: { id } });
}

// Same pairwise swap as moveCuponeraBrand (lib/cuponera/admin.ts).
export async function moveCuponeraList(id: string, direction: "up" | "down"): Promise<void> {
  const lists = await getCuponeraLists();
  const idx = lists.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("not_found");
  const other = lists[direction === "up" ? idx - 1 : idx + 1];
  const current = lists[idx];
  if (!other || !current) return;
  if (other.position === current.position) {
    await db.$transaction(lists.map((l, i) => db.cuponeraList.update({ where: { id: l.id }, data: { position: i } })));
    return moveCuponeraList(id, direction);
  }
  await db.$transaction([
    db.cuponeraList.update({ where: { id: current.id }, data: { position: other.position } }),
    db.cuponeraList.update({ where: { id: other.id }, data: { position: current.position } }),
  ]);
}
