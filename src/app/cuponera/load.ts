import { notFound } from "next/navigation";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getCuponeraView } from "@/lib/cuponera/data";
import { CUPONERA_DEFAULT_TEXTS, getCuponeraSettings } from "@/lib/cuponera/settings";
import { categoryTree, frontPageRows, type CuponeraCategoryLink, type CuponeraListPage, type CuponeraRow, type CuponeraTile } from "@/lib/cuponera/browse";
import type { CuponeraBrandCard, CuponeraProduct } from "@/lib/cuponera/shared";
import { SAMPLE_BRANDS, SAMPLE_NEW, SAMPLE_PRODUCTS } from "@/lib/cuponera/sampleData";

// What every page of the cuponera (/cuponera and its collections) reads,
// with the same rule for who sees it: visitors once it's published in
// /admin/cuponera, staff always — and, before the first Marcolini sync, the
// sample preview, staff-only.

export interface CuponeraPageData {
  sample: boolean;
  published: boolean;
  texts: typeof CUPONERA_DEFAULT_TEXTS;
  /** How the brands show under the title: logos sliding by on their own
   * ("marcas", like Rakuten) or a panel slid by hand ("panel"). */
  heroStyle: "marcas" | "panel";
  /** The brands under the title (empty when that section is off). */
  panelBrands: CuponeraBrandCard[];
  /** "Descubre por categoría": a picture per category key, uploaded in the admin. */
  categoryImages: Record<string, string>;
  brands: CuponeraBrandCard[];
  categories: CuponeraCategoryLink[];
  rows: CuponeraRow[];
  products: CuponeraProduct[];
  bestsellers: CuponeraTile[];
  newProducts: CuponeraProduct[];
  lists: CuponeraListPage[];
}

function sampleData(): CuponeraPageData {
  const products = [...SAMPLE_PRODUCTS, ...SAMPLE_NEW];
  const lists: CuponeraListPage[] = [
    {
      slug: "esmaltes-semipermanentes",
      title: "Esmaltes semipermanentes",
      subtitle: "De todas las marcas",
      kind: "category",
      category: "esmaltes",
      subcategory: "semipermanente",
      products: products.filter((p) => p.category === "esmaltes" && p.subcategory === "semipermanente"),
    },
    {
      slug: "herramientas",
      title: "Herramientas y equipos",
      subtitle: "Lámparas, limas, pinceles y más",
      kind: "category",
      category: "herramientas",
      subcategory: null,
      products: products.filter((p) => p.category === "herramientas"),
    },
  ];
  return {
    sample: true,
    published: false,
    texts: CUPONERA_DEFAULT_TEXTS,
    heroStyle: "marcas",
    panelBrands: SAMPLE_BRANDS,
    categoryImages: {},
    brands: SAMPLE_BRANDS,
    categories: categoryTree(products),
    rows: frontPageRows({ bestsellers: [], lists, newProducts: SAMPLE_NEW, newTitle: CUPONERA_DEFAULT_TEXTS.newTitle, newSubtitle: CUPONERA_DEFAULT_TEXTS.newSubtitle }),
    products,
    bestsellers: [],
    newProducts: SAMPLE_NEW,
    lists,
  };
}

export async function loadCuponera(): Promise<{ data: CuponeraPageData; staff: boolean }> {
  const [staff, view] = await Promise.all([viewerCanSeeSamples(), getCuponeraView()]);
  if (view ? !view.settings.published && !staff : !staff) notFound();
  if (!view) return { staff, data: sampleData() };
  return {
    staff,
    data: {
      sample: false,
      published: view.settings.published,
      texts: view.texts,
      heroStyle: view.settings.heroStyle === "panel" ? "panel" : "marcas",
      categoryImages: imagesOf(view.settings.categoryImages),
      panelBrands: view.settings.showCoupons ? view.brands.filter((b) => b.inPanel) : [],
      brands: view.brands,
      categories: view.categories,
      rows: view.rows,
      products: view.products,
      bestsellers: view.bestsellers,
      newProducts: view.newProducts,
      lists: view.lists,
    },
  };
}

function imagesOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Indexed only once it's public; the preview never is. */
export async function cuponeraRobots() {
  const settings = await getCuponeraSettings();
  return settings.published ? undefined : { index: false, follow: false };
}

/** The staff banner while the page isn't public (or is the sample). */
export function staffNote(data: CuponeraPageData): string | null {
  if (data.sample) return "Datos de ejemplo: las marcas y los precios no son reales y los links todavía no abren tiendas.";
  if (!data.published) return "La cuponera todavía no es pública: el resto de las personas ven «página no encontrada».";
  return null;
}
