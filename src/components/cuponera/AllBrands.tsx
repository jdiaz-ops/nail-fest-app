import BrandLink, { BrandLogo } from "./BrandLink";
import { formatPercent, type CuponeraBrandCard } from "@/lib/cuponera/shared";

// "Todas las marcas", at the end of the front page (iGraal's store
// directory): every brand as a chip — logo, name, discount — each one to
// its store.
export default function AllBrands({ brands, displayClassName }: { brands: CuponeraBrandCard[]; displayClassName: string }) {
  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <section className="cup-allbrands" aria-labelledby="cup-allbrands-title">
      <h2 id="cup-allbrands-title" className={`cup-h2 ${displayClassName}`}>
        Todas las marcas
      </h2>
      <p className="cup-sub">Las que tienen descuento con Nail Fest. Toca una para ir a su tienda.</p>
      <div className="cup-brandchips">
        {sorted.map((b) => (
          <BrandLink key={b.id} brand={b} className="cup-brandchip">
            <BrandLogo brand={b} size="xs" />
            <span>{b.name}</span>
            <b>{formatPercent(b.discountPercent)}</b>
          </BrandLink>
        ))}
      </div>
    </section>
  );
}
