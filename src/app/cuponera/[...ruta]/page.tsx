import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CollectionView, { type CollectionType } from "@/components/cuponera/CollectionView";
import { collectionHref, listHref, tileProducts } from "@/lib/cuponera/browse";
import { getCuponeraLists } from "@/lib/cuponera/lists";
import { categoryLabel, isCategory, isSubcategoryOf, subcategoryLabel, type CuponeraProduct } from "@/lib/cuponera/shared";
import { cuponeraRobots, loadCuponera, type CuponeraPageData } from "../load";
import { fraunces } from "../fonts";
import CuponeraShell from "../shell";

export const dynamic = "force-dynamic";

type Params = { params: { ruta: string[] }; searchParams: { q?: string } };

interface Collection {
  title: string;
  subtitle: string | null;
  back: { href: string; label: string };
  products: CuponeraProduct[];
  types: CollectionType[];
  search: boolean;
  emptyText: string;
}

const HOME = { href: "/cuponera", label: "Cuponera" };

// The cuponera's collection pages, every brand's products together:
//   /cuponera/esmaltes                   a category (its types to jump to)
//   /cuponera/esmaltes/semipermanente    a type
//   /cuponera/lista/para-empezar         one of the admin's lists
//   /cuponera/todo · /buscar?q= · /lo-mas-comprado · /lo-nuevo
function resolve(ruta: string[], data: CuponeraPageData): Collection | null {
  const [first, second, ...rest] = ruta;
  if (!first || rest.length > 0) return null;
  const base = { subtitle: null, back: HOME, types: [] as CollectionType[], search: false };

  if (!second) {
    if (first === "todo") return { ...base, title: "Toda la cuponera", products: data.products, emptyText: "Todavía no hay productos." };
    if (first === "buscar") return { ...base, title: "Buscar", products: data.products, search: true, emptyText: "Todavía no hay productos." };
    if (first === "lo-mas-comprado") {
      return {
        ...base,
        title: "Lo más comprado por la comunidad",
        subtitle: "Con los códigos de Nail Fest, últimos 90 días",
        products: data.bestsellers.flatMap(tileProducts),
        emptyText: "Todavía no hay suficientes compras con los códigos de Nail Fest.",
      };
    }
    if (first === "lo-nuevo") {
      return { ...base, title: data.texts.newTitle, subtitle: data.texts.newSubtitle, products: data.newProducts, emptyText: "No llegó nada nuevo en estos días." };
    }
  }

  if (first === "lista" && second) {
    const list = data.lists.find((l) => l.slug === second);
    if (!list) return null;
    // A category list is that category's collection, with its filters.
    if (list.category) redirect(listHref(list));
    return { ...base, title: list.title, subtitle: list.subtitle, products: list.products, emptyText: "Esta lista todavía no tiene productos." };
  }

  if (!isCategory(first)) return null;
  const category = data.categories.find((c) => c.key === first);
  const inCategory = data.products.filter((p) => p.category === first);
  const types: CollectionType[] = (category?.subcategories ?? []).map((s) => ({ label: s.label, href: collectionHref(first, s.key), active: s.key === second }));

  if (!second) {
    return { ...base, title: categoryLabel(first), types, products: inCategory, emptyText: "Todavía no hay productos en esta categoría." };
  }
  if (!isSubcategoryOf(first, second)) return null;
  return {
    ...base,
    title: subcategoryLabel(first, second) ?? categoryLabel(first),
    back: { href: collectionHref(first), label: categoryLabel(first) },
    types: [{ label: "Todo", href: collectionHref(first), active: false }, ...types],
    products: inCategory.filter((p) => p.subcategory === second),
    emptyText: "Todavía no hay productos de este tipo.",
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [first, second] = params.ruta;
  let title = "Cuponera";
  if (first === "todo") title = "Toda la cuponera";
  else if (first === "buscar") title = "Buscar";
  else if (first === "lo-mas-comprado") title = "Lo más comprado";
  else if (first === "lo-nuevo") title = "Lo nuevo";
  else if (first === "lista" && second) title = (await getCuponeraLists()).find((l) => l.slug === second)?.title ?? "Lista";
  else if (isCategory(first)) title = (second && subcategoryLabel(first, second)) || categoryLabel(first);
  return { title: `${title} · Cuponera Nail Fest`, robots: await cuponeraRobots() };
}

export default async function CuponeraCollectionPage({ params, searchParams }: Params) {
  const { data } = await loadCuponera();
  const collection = resolve(params.ruta, data);
  if (!collection) notFound();

  const brandCount = new Set(collection.products.map((p) => p.brand)).size;
  const count = `${collection.products.length === 1 ? "1 producto" : `${collection.products.length} productos`}${
    brandCount > 1 ? ` de ${brandCount} marcas` : brandCount === 1 ? ` de ${collection.products[0]!.brand}` : ""
  }`;

  return (
    <CuponeraShell data={data}>
      <div className="cup-wrap cup-wrap--collection">
        <div className="cup-coll-head">
          <Link href={collection.back.href} className="cup-back">
            ← {collection.back.label}
          </Link>
          <h1 className={`cup-coll-title ${fraunces.className}`}>{collection.title}</h1>
          <p className="cup-sub">{collection.search ? `Entre ${count}` : collection.subtitle ? `${collection.subtitle} · ${count}` : count}</p>
        </div>
        <CollectionView
          products={collection.products}
          types={collection.types}
          search={collection.search}
          initialQuery={collection.search ? (searchParams.q ?? "").slice(0, 100) : ""}
          emptyText={collection.emptyText}
          displayClassName={fraunces.className}
        />
      </div>
    </CuponeraShell>
  );
}
