import Countdown from "./Countdown";
import ProductPhoto from "./ProductPhoto";
import PreviewLink from "./PreviewLink";
import { discountPercent, formatCop, type CuponeraProduct } from "@/lib/cuponera/shared";

// Past two days a ticking hours counter reads oddly ("820:15:03"); a pinned
// deal that long shows its end date instead. Rendered on the server only.
const LONG_RUN_SECONDS = 48 * 3600;
const untilFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });

// "Robo del día": one product for a day (Ulta's daily steal, Mercado
// Libre's ofertas relámpago). endsAt null = a product the admin pinned with
// no end date, so there's nothing to count down to. The "unidades
// limitadas" bar only belongs to the sample preview: the real catalog has
// no stock numbers to back it.
export default function DealOfTheDay({
  product,
  endsAt,
  initialSeconds,
  sample = false,
}: {
  product: CuponeraProduct;
  endsAt: string | null;
  initialSeconds: number;
  sample?: boolean;
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
        {endsAt &&
          (initialSeconds > LONG_RUN_SECONDS ? (
            <span className="cup-deal-until">Hasta el {untilFormatter.format(new Date(endsAt))}</span>
          ) : (
            <Countdown endsAt={endsAt} initialSeconds={initialSeconds} />
          ))}
      </div>
      <div className="cup-deal-body">
        <div className="cup-deal-photo" style={{ background: product.tint }}>
          {off > 0 && <span className="cup-off cup-off--big">−{off} %</span>}
          <ProductPhoto product={product} size={104} />
        </div>
        <div className="cup-deal-info">
          <span className="cup-brandname">{product.brand}</span>
          <span className="cup-deal-name">{product.name}</span>
          <span className="cup-prices cup-prices--big">
            <span className="cup-price">
              {product.priceFrom && <span className="cup-from">Desde </span>}
              {formatCop(product.price)}
            </span>
            {off > 0 && <span className="cup-before">{formatCop(product.before)}</span>}
          </span>
        </div>
        {sample && (
          <div className="cup-stock">
            <div className="cup-stock-bar">
              <span style={{ width: "72%" }} />
            </div>
            <span className="cup-stock-text">Unidades limitadas</span>
          </div>
        )}
        <PreviewLink
          href={product.url}
          preview={`Vista previa: aquí se abriría ${product.name} en la tienda de ${product.brand}, con el código ${product.code}.`}
          className="cup-btn"
        >
          Comprar con descuento
        </PreviewLink>
        <span className="cup-note">
          Se compra en la tienda de {product.brand}, con el código <b className="cup-mono">{product.code}</b>.
        </span>
      </div>
    </div>
  );
}
