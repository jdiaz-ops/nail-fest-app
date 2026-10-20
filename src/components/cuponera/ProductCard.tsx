import ProductIcon from "./ProductIcon";
import PreviewLink from "./PreviewLink";
import { discountPercent, formatCop, type CuponeraProduct } from "@/lib/cuponera/sampleData";

// The cuponera's product card: Marcolini's vitrina card (brand, name, the
// creator's code, "Ver en la tienda") plus the before/now price and the
// discount badge it never showed.
export default function ProductCard({ product }: { product: CuponeraProduct }) {
  const off = discountPercent(product.price, product.before);
  return (
    <PreviewLink
      href={product.url}
      preview={`Vista previa: aquí se abriría ${product.name} en la tienda de ${product.brand}, con el código NAILFEST.`}
      className="cup-card"
    >
      <div className="cup-card-photo" style={{ background: product.tint }}>
        {off > 0 && <span className="cup-off">−{off} %</span>}
        <ProductIcon kind={product.icon} color={product.color} size={66} />
      </div>
      <div className="cup-card-body">
        <span className="cup-brandname">{product.brand}</span>
        <span className="cup-card-name">{product.name}</span>
        <span className="cup-prices">
          <span className="cup-price">{formatCop(product.price)}</span>
          {off > 0 && <span className="cup-before">{formatCop(product.before)}</span>}
        </span>
        <span className="cup-card-code">
          con el código <b className="cup-mono">NAILFEST</b>
        </span>
        <span className="cup-card-cta">Ver en la tienda</span>
      </div>
    </PreviewLink>
  );
}
