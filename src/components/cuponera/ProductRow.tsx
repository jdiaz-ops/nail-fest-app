import Link from "next/link";
import ProductTiles from "./ProductTiles";
import type { CuponeraRow } from "@/lib/cuponera/browse";

// One sliding row of the front page ("Lo más comprado", a list, "Lo
// nuevo"), with "Ver todo" to its collection.
export default function ProductRow({ row, displayClassName }: { row: CuponeraRow; displayClassName: string }) {
  const titleId = `cup-row-${row.key}`;
  return (
    <section className="cup-shelf" aria-labelledby={titleId}>
      <div className="cup-shelf-head">
        <div>
          <h2 id={titleId} className={`cup-h2 ${displayClassName}`}>
            {row.title}
          </h2>
          {row.subtitle && <p className="cup-sub">{row.subtitle}</p>}
        </div>
        {row.href && (
          <Link href={row.href} className="cup-shelf-all">
            Ver todo
          </Link>
        )}
      </div>
      <ProductTiles tiles={row.tiles} ranked={row.ranked} isNew={row.isNew} layout="row" displayClassName={displayClassName} />
    </section>
  );
}
