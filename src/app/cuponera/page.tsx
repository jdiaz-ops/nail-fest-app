import type { Metadata } from "next";
import BrandsPanel from "@/components/cuponera/BrandsPanel";
import BrandsMarquee from "@/components/cuponera/BrandsMarquee";
import ProductRow from "@/components/cuponera/ProductRow";
import AllBrands from "@/components/cuponera/AllBrands";
import CategoryTiles from "@/components/cuponera/CategoryTiles";
import CuponeraFooter from "@/components/cuponera/CuponeraFooter";
import { cuponeraRobots, loadCuponera } from "./load";
import { fraunces } from "./fonts";
import CuponeraShell from "./shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cuponera · Nail Fest",
    description: "Los descuentos de las marcas de Nail Fest, todo el año.",
    robots: await cuponeraRobots(),
  };
}

// "Precios de feria, todo el año": what follows the last comma gets the
// accent color. A title without a comma stays in one color.
function titleParts(title: string): [string, string | null] {
  const cut = title.lastIndexOf(", ");
  return cut > 0 ? [title.slice(0, cut + 1), title.slice(cut + 2)] : [title, null];
}

// nailfest.lat/cuponera — the year-round coupon book's front page: the
// promise and the brands with their discounts (logos drifting by like
// Rakuten's, or a panel slid by hand like Student Beans' — the admin picks),
// the search and the categories, the rows (what the community buys most,
// the admin's lists, what's new) and every brand at the end. The
// collections live in ./[...ruta]; the only way out is a store.
export default async function CuponeraPage() {
  const { data } = await loadCuponera();
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
      {data.heroStyle === "panel" ? (
        <section className="cup-hero2">
          <div className="cup-hero2-inner">
            <h1 className={`cup-hero2-title ${fraunces.className}`}>{title}</h1>
            <p className="cup-hero2-lede">{data.texts.heroLede}</p>
            {data.panelBrands.length > 0 && <BrandsPanel brands={data.panelBrands} displayClassName={fraunces.className} />}
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
          <form className="cup-search" role="search" action="/cuponera/buscar" method="get">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <label htmlFor="cup-q" className="cup-sr">
              Buscar productos
            </label>
            <input id="cup-q" name="q" type="search" placeholder="Busca marcas, productos o categorías" autoComplete="off" enterKeyHint="search" />
          </form>
        </section>

        {data.categories.length > 0 && <CategoryTiles categories={data.categories} images={data.categoryImages} displayClassName={fraunces.className} />}

        {data.rows.map((row) => (
          <ProductRow key={row.key} row={row} displayClassName={fraunces.className} />
        ))}

        {data.brands.length > 0 && <AllBrands brands={data.brands} displayClassName={fraunces.className} />}

        <CuponeraFooter />
      </div>
    </CuponeraShell>
  );
}
