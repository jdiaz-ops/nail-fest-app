import BrandLink, { BrandLogo } from "./BrandLink";
import { formatPercent, type CuponeraBrandCard } from "@/lib/cuponera/shared";

/** The store's address as people read it: "hlacosedora.com". */
export function storeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// A brand as a coupon of the book: who, how much and where; past the
// perforation, the code and the way to the store. The whole coupon is one
// link — the code is copied and the store opens (BrandLink).
export default function BrandCoupon({ brand, className }: { brand: CuponeraBrandCard; className?: string }) {
  const percent = formatPercent(brand.discountPercent);
  const host = storeHost(brand.storeUrl);
  // The admin's own title ("15 % en toda la tienda") says more than the default.
  const custom = brand.title !== `${percent} de descuento` ? brand.title : null;
  return (
    <BrandLink brand={brand} className={className ? `cup-ticket ${className}` : "cup-ticket"}>
      <span className="cup-ticket-main">
        <BrandLogo brand={brand} size="md" />
        <span className="cup-ticket-info">
          <span className="cup-ticket-brand">
            {brand.name}
            {brand.exclusive && <span className="cup-exclusive">Exclusivo</span>}
          </span>
          <span className="cup-ticket-offer">
            <b>{percent}</b> de descuento
          </span>
          <span className="cup-ticket-where">{custom ?? (host ? `En su tienda en línea, ${host}` : "En su tienda en línea")}</span>
        </span>
      </span>
      <span className="cup-ticket-stub">
        <span className="cup-ticket-code">
          <small>Tu código</small>
          <code>{brand.code}</code>
        </span>
        <span className="cup-ticket-go">
          Ir a la tienda
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </span>
      </span>
      {brand.shipping && <span className="cup-ticket-ship">{brand.shipping}</span>}
    </BrandLink>
  );
}
