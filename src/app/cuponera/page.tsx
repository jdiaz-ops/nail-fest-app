import type { Metadata } from "next";
import BrandsPanel from "@/components/cuponera/BrandsPanel";
import BrandsMarquee from "@/components/cuponera/BrandsMarquee";
import ProductRow from "@/components/cuponera/ProductRow";
import AllBrands from "@/components/cuponera/AllBrands";
import CategoryTiles from "@/components/cuponera/CategoryTiles";
import SearchSuggest from "@/components/cuponera/SearchSuggest";
import { categoryTiles, suggestionIndex } from "@/lib/cuponera/browse";
import { EXAMPLE_PANEL_BRANDS } from "@/lib/cuponera/sampleData";
import { cuponeraRobots, loadCuponera } from "./load";
import { fraunces } from "./fonts";
import CuponeraShell from "./shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cuponera · Nail Fest",
    description: "Ahorra todo el año con los descuentos de las marcas de Nail Fest: para manicuristas profesionales, estudiantes y educadoras.",
    robots: await cuponeraRobots(),
  };
}

// The coupons panel shows six brands at a glance and slides for more. While
// there are few real ones, the team sees invented examples up to eighteen —
// enough to slide through, asked on 2026-10-20 — and visitors see "muy
// pronto" up to six: never a code that doesn't exist.
const PANEL_EXAMPLES_UP_TO = 18;
const PANEL_SOON_UP_TO = 6;

// "Precios de feria, todo el año": what follows the last comma gets the
// accent color. A title without a comma stays in one color.
function titleParts(title: string): [string, string | null] {
  const cut = title.lastIndexOf(", ");
  return cut > 0 ? [title.slice(0, cut + 1), title.slice(cut + 2)] : [title, null];
}

// nailfest.lat/cuponera — the year-round coupon book's front page: the
// promise and the brands with their discounts and codes (logos drifting by
// like Rakuten's, or a panel slid by hand like Student Beans', as rows or
// as coupons — the admin picks), the search with its suggestions and the
// categories, the rows (what the community buys most, the admin's lists,
// what's new) and every brand at the end. Each section can be renamed or
// hidden in Editar cuponera. The collections live in ./[...ruta]; the only
// way out is a store.
export default async function CuponeraPage() {
  const { data, staff } = await loadCuponera();
  const filling = data.heroStyle === "cupones" && !data.sample;
  const examples = filling && staff ? EXAMPLE_PANEL_BRANDS.slice(0, Math.max(0, PANEL_EXAMPLES_UP_TO - data.panelBrands.length)) : [];
  const soon = filling && !staff ? Math.max(0, PANEL_SOON_UP_TO - data.panelBrands.length) : 0;
  const [titleStart, titleEnd] = titleParts(data.texts.heroTitle);
  const title = (
    <>
      {titleStart}
      {titleEnd && (
        <>
          {" "}
          <em>{titleEnd}</em>
        </>
      )}
    </>
  );

  return (
    <CuponeraShell data={data}>
      {data.heroStyle !== "marcas" ? (
        <section className={data.heroStyle === "cupones" && data.panelBrands.length > 0 ? "cup-hero2 cup-hero2--coupons" : "cup-hero2"}>
          <div className="cup-hero2-inner">
            <div className="cup-hero2-copy">
              <h1 className={`cup-hero2-title ${fraunces.className}`}>{title}</h1>
              <p className="cup-hero2-lede">{data.texts.heroLede}</p>
            </div>
            {data.panelBrands.length > 0 && (
              <BrandsPanel
                brands={data.panelBrands}
                title={data.texts.panelTitle}
                variant={data.heroStyle === "cupones" ? "coupons" : "rows"}
                examples={examples}
                soon={soon}
                displayClassName={fraunces.className}
              />
            )}
          </div>
        </section>
      ) : (
        <section className="cup-hero3">
          <h1 className={`cup-hero3-title ${fraunces.className}`}>{title}</h1>
          <p className="cup-hero3-lede">{data.texts.heroLede}</p>
          {data.panelBrands.length > 0 && <BrandsMarquee brands={data.panelBrands} />}
        </section>
      )}

      <div className="cup-wrap cup-wrap--home">
        <section className="cup-find" aria-label="Buscar">
          <SearchSuggest index={suggestionIndex(data.products, data.brands, data.categories)} />
        </section>

        {data.showCategories && data.categories.length > 0 && (
          <CategoryTiles
            tiles={categoryTiles({
              categories: data.categories,
              images: data.categoryImages,
              bestsellers: data.bestsellers,
              newProducts: data.newProducts,
              lists: data.lists,
              brandCount: data.showAllBrands ? data.brands.length : 0,
              productCount: data.products.length,
            })}
            title={data.texts.categoriesTitle}
            displayClassName={fraunces.className}
          />
        )}

        {data.rows.map((row) => (
          <ProductRow key={row.key} row={row} displayClassName={fraunces.className} />
        ))}

        {data.showAllBrands && data.brands.length > 0 && (
          <AllBrands brands={data.brands} title={data.texts.allBrandsTitle} subtitle={data.texts.allBrandsSubtitle} displayClassName={fraunces.className} />
        )}
      </div>
    </CuponeraShell>
  );
}
