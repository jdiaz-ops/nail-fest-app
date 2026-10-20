import Countdown from "./Countdown";
import ProductIcon from "./ProductIcon";
import PreviewLink from "./PreviewLink";
import { discountPercent, formatCop, type CuponeraProduct } from "@/lib/cuponera/sampleData";

// "Robo del día": one product with a deep discount for 24 hours (Ulta's
// daily steal, Mercado Libre's ofertas relámpago).
export default function DealOfTheDay({
  product,
  endsAt,
  initialSeconds,
}: {
  product: CuponeraProduct;
  endsAt: string;
  initialSeconds: number;
}) {
  const off = discountPercent(product.price, product.before);
  return (
    <div className="cup-deal">
      <div className="cup-deal-head">
        <span className="cup-deal-label">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5471a" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
          Robo del día
        </span>
        <Countdown endsAt={endsAt} initialSeconds={initialSeconds} />
      </div>
      <div className="cup-deal-body">
        <div className="cup-deal-photo" style={{ background: product.tint }}>
          <span className="cup-off cup-off--big">−{off} %</span>
          <ProductIcon kind={product.icon} color={product.color} size={104} />
        </div>
        <div className="cup-deal-info">
          <span className="cup-brandname">{product.brand}</span>
          <span className="cup-deal-name">{product.name}</span>
          <span className="cup-prices cup-prices--big">
            <span className="cup-price">{formatCop(product.price)}</span>
            <span className="cup-before">{formatCop(product.before)}</span>
          </span>
        </div>
        <div className="cup-stock">
          <div className="cup-stock-bar">
            <span style={{ width: "72%" }} />
          </div>
          <span className="cup-stock-text">Unidades limitadas</span>
        </div>
        <PreviewLink
          href={product.url}
          preview={`Vista previa: aquí se abriría ${product.name} en la tienda de ${product.brand}, con el código NAILFEST.`}
          className="cup-btn"
        >
          Comprar con descuento
        </PreviewLink>
        <span className="cup-note">
          Se compra en la tienda de {product.brand}, con el código <b className="cup-mono">NAILFEST</b>.
        </span>
      </div>
    </div>
  );
}
