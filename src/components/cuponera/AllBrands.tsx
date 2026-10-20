import BrandLink, { BrandLogo } from "./BrandLink";
import { formatPercent, type CuponeraBrandCard } from "@/lib/cuponera/shared";

// "Todas las marcas", at the end of the front page (iGraal's store
// directory): every brand as a chip — logo, name and code, the discount big
// on the side — each one to its store. "Marcas" in the tiles up top jumps
// here (#marcas).
export default function AllBrands({
  brands,
  title,
  subtitle,
  displayClassName,
}: {
  brands: CuponeraBrandCard[];
  title: string;
  subtitle: string;
  displayClassName: string;
}) {
  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <section id="marcas" className="cup-allbrands" aria-labelledby="cup-allbrands-title">
      <h2 id="cup-allbrands-title" className={`cup-h2 ${displayClassName}`}>
        {title}
      </h2>
      {subtitle && <p className="cup-sub">{subtitle}</p>}
      <div className="cup-brandchips">
        {sorted.map((b) => (
          <BrandLink key={b.id} brand={b} className="cup-brandchip">
            <BrandLogo brand={b} size="xs" />
            <span className="cup-brandchip-text">
              <b>{b.name}</b>
              <small>
                con el código <code className="cup-code-chip">{b.code}</code>
              </small>
            </span>
            <strong className="cup-brandchip-off">{formatPercent(b.discountPercent)}</strong>
          </BrandLink>
        ))}
      </div>
    </section>
  );
}
