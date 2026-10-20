"use client";

import ProductCard from "./ProductCard";
import LineCard from "./LineCard";
import type { CuponeraTile } from "@/lib/cuponera/browse";

// A grid of product cards, where the tones of a line share one card
// (lib/cuponera/browse.ts groupByLine). ranked numbers them: "Lo más comprado".
export default function ProductTiles({
  tiles,
  ranked = false,
  displayClassName = "",
}: {
  tiles: CuponeraTile[];
  ranked?: boolean;
  displayClassName?: string;
}) {
  return (
    <div className="cup-grid">
      {tiles.map((tile, i) =>
        tile.kind === "product" ? (
          <ProductCard key={tile.key} product={tile.product} rank={ranked ? i + 1 : undefined} />
        ) : (
          <LineCard key={tile.key} line={tile.line} rank={ranked ? i + 1 : undefined} displayClassName={displayClassName} />
        ),
      )}
    </div>
  );
}
