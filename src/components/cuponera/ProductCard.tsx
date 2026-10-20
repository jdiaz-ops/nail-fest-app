import ProductPhoto from "./ProductPhoto";
import PreviewLink from "./PreviewLink";
import Rating from "./Rating";
import { discountPercent, formatCop, type CuponeraProduct } from "@/lib/cuponera/shared";

// At or below this many units in stock the card says so ("Últimas 3 unidades").
const LAST_UNITS = 5;

export function lastUnitsText(unitsLeft: number | null, limit = LAST_UNITS): string | null {
  if (unitsLeft == null || unitsLeft <= 0 || unitsLeft > limit) return null;
  return unitsLeft === 1 ? "Última unidad" : `Últimas ${unitsLeft} unidades`;
}

// Its place in "Lo más comprado".
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="cup-rank">
      <span className="cup-sr">Puesto </span>
      <span aria-hidden="true">#</span>
      {rank}
    </span>
  );
}

// The cuponera's product card: Marcolini's vitrina card (brand, name, the
// creator's code, "Ver en la tienda") plus the before/now price and the
// discount badge it never showed, its reviews, its variants and — when the
// store tracks stock — the last units.
export default function ProductCard({ product, rank }: { product: CuponeraProduct; rank?: number }) {
  const off = discountPercent(product.price, product.before);
  const lastUnits = lastUnitsText(product.unitsLeft);
  return (
    <PreviewLink
      href={product.url}
      preview={`Vista previa: aquí se abriría ${product.name} en la tienda de ${product.brand}, con el código ${product.code}.`}
      className="cup-card"
    >
      <div className="cup-card-photo" style={{ background: product.tint }}>
        {off > 0 && <span className="cup-off">−{off} %</span>}
        {rank != null && <RankBadge rank={rank} />}
        <ProductPhoto product={product} size={66} />
      </div>
      <div className="cup-card-body">
        <span className="cup-brandname">{product.brand}</span>
        <span className="cup-card-name">{product.name}</span>
        {(product.rating || product.variantsLabel) && (
          <span className="cup-card-meta">
            {product.rating && <Rating rating={product.rating} />}
            {product.variantsLabel && <span>{product.variantsLabel}</span>}
          </span>
        )}
        <span className="cup-prices">
          <span className="cup-price">
            {product.priceFrom && <span className="cup-from">Desde </span>}
            {formatCop(product.price)}
          </span>
          {off > 0 && <span className="cup-before">{formatCop(product.before)}</span>}
        </span>
        {lastUnits && <span className="cup-last">{lastUnits}</span>}
        <span className="cup-card-code">
          con el código <b className="cup-mono">{product.code}</b>
        </span>
        <span className="cup-card-cta">Ver en la tienda</span>
      </div>
    </PreviewLink>
  );
}
