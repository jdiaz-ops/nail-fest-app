import Link from "next/link";
import ProductIcon from "./ProductIcon";
import { CATEGORY_ART } from "./categoryArt";
import { collectionHref, type CuponeraCategoryLink } from "@/lib/cuponera/browse";

// "Descubre por categoría", under the search: a tile per category with
// products — the admin's picture, or its drawing — each opening its
// collection (every brand's products, with the filters).
export default function CategoryTiles({
  categories,
  images,
  displayClassName,
}: {
  categories: CuponeraCategoryLink[];
  images: Record<string, string>;
  displayClassName: string;
}) {
  return (
    <section className="cup-cats" aria-labelledby="cup-cats-title">
      <div className="cup-shelf-head">
        <h2 id="cup-cats-title" className={`cup-h2 ${displayClassName}`}>
          Descubre por categoría
        </h2>
        <Link href="/cuponera/todo" className="cup-shelf-all">
          Ver todo
        </Link>
      </div>
      <div className="cup-cats-grid">
        {categories.map((c) => {
          const image = images[c.key];
          const art = CATEGORY_ART[c.key];
          const count = c.count === 1 ? "1 producto" : `${c.count} productos`;
          return (
            <Link key={c.key} href={collectionHref(c.key)} className={image ? "cup-cat cup-cat--photo" : "cup-cat"} style={image ? undefined : { background: art.background }}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- picture uploaded in Editar cuponera (Vercel Blob)
                <img className="cup-cat-img" src={image} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="cup-cat-art" aria-hidden="true">
                  <ProductIcon kind={art.icon} color={art.color} size={64} />
                </span>
              )}
              <span className="cup-cat-label">
                <b className={image ? undefined : displayClassName}>{c.chip}</b>
                <small>{count}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
