"use client";

import ProductCard from "./ProductCard";
import LineCard from "./LineCard";
import type { CuponeraTile } from "@/lib/cuponera/browse";

// Product cards — a grid, or a row that slides sideways — where the tones of
// a line share one card (lib/cuponera/browse.ts groupByLine). ranked numbers
// them: "Lo más comprado".
export default function ProductTiles({
  tiles,
  ranked = false,
  isNew = false,
  layout = "grid",
  displayClassName = "",
}: {
  tiles: CuponeraTile[];
  ranked?: boolean;
  isNew?: boolean;
  layout?: "grid" | "row";
  displayClassName?: string;
}) {
  return (
    <div className={layout === "row" ? "cup-shelf-track" : "cup-grid"}>
      {tiles.map((tile, i) =>
        tile.kind === "product" ? (
          <ProductCard key={tile.key} product={tile.product} rank={ranked ? i + 1 : undefined} isNew={isNew} />
        ) : (
          <LineCard key={tile.key} line={tile.line} rank={ranked ? i + 1 : undefined} isNew={isNew} displayClassName={displayClassName} />
        ),
      )}
    </div>
  );
}
