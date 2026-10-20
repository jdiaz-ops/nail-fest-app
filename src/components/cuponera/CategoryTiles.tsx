import Link from "next/link";
import ProductIcon from "./ProductIcon";
import { TILE_ART } from "./categoryArt";
import type { CuponeraCategoryTile } from "@/lib/cuponera/browse";

// "Explora ahorros por categoría", under the search: a tile per category
// with products — the admin's picture, or its drawing — each opening its
// collection (every brand's products, with the filters). When the last row
// would come out short, other ways in close it, "Todo" last
// (lib/cuponera/browse.ts, categoryTiles).
export default function CategoryTiles({ tiles, title, displayClassName }: { tiles: CuponeraCategoryTile[]; title: string; displayClassName: string }) {
  const closesWithTodo = tiles.some((t) => t.key === "todo");
  return (
    <section className="cup-cats" aria-labelledby="cup-cats-title">
      <div className="cup-shelf-head">
        <h2 id="cup-cats-title" className={`cup-h2 ${displayClassName}`}>
          {title}
        </h2>
        {!closesWithTodo && (
          <Link href="/cuponera/todo" className="cup-shelf-all">
            Ver todo
          </Link>
        )}
      </div>
      <div className={`cup-cats-grid cup-cats-grid--n${tiles.length}`}>
        {tiles.map((t) => {
          const art = TILE_ART[t.art];
          const body = (
            <>
              {t.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- picture uploaded in Editar cuponera (Vercel Blob)
                <img className="cup-cat-img" src={t.image} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="cup-cat-art" aria-hidden="true">
                  <ProductIcon kind={art.icon} color={art.color} size={64} />
                </span>
              )}
              <span className={t.label.length > 12 ? "cup-cat-label cup-cat-label--long" : "cup-cat-label"}>
                <b className={t.image ? undefined : displayClassName}>{t.label}</b>
                <small>{t.count}</small>
              </span>
            </>
          );
          const className = t.image ? "cup-cat cup-cat--photo" : "cup-cat";
          const style = t.image ? undefined : { background: art.background };
          // "Marcas" jumps down the same page.
          return t.href.startsWith("#") ? (
            <a key={t.key} href={t.href} className={className} style={style}>
              {body}
            </a>
          ) : (
            <Link key={t.key} href={t.href} className={className} style={style}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
