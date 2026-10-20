import BrandLink from "./BrandLink";
import { formatPercent, type CuponeraBrandCard } from "@/lib/cuponera/shared";

// Each loop copy holds at least this many cards, so a wide screen never
// sees the end of a row.
const CARDS_PER_COPY = 10;
// Seconds a card takes to move its own width: an unhurried drift.
const SECONDS_PER_CARD = 3.2;
// Rows move at slightly different speeds, like Rakuten's.
const ROW_SPEEDS = [1, 1.18, 0.9, 1.3];

function rowsOf(brands: CuponeraBrandCard[]): CuponeraBrandCard[][] {
  const count = brands.length >= 12 ? 4 : brands.length >= 6 ? 3 : brands.length >= 2 ? 2 : 1;
  // Too few to split (a row of one logo looks stuck): every row shows them
  // all, every other row in reverse, so the same logos don't line up.
  const split = brands.length >= count * 2;
  const rows: CuponeraBrandCard[][] = Array.from({ length: count }, (_, r) => (split ? [] : r % 2 ? [...brands].reverse() : [...brands]));
  if (split) brands.forEach((b, i) => rows[i % count]!.push(b));
  return rows.map((row, r) => {
    // Start each row elsewhere, so the same brand doesn't stack up.
    const shift = split && row.length > 1 ? r % row.length : 0;
    const turned = [...row.slice(shift), ...row.slice(0, shift)];
    let copy = turned;
    while (copy.length < CARDS_PER_COPY) copy = copy.concat(turned);
    return copy;
  });
}

// The brands under the title, Rakuten style: rows of logo cards drifting
// left on their own, the discount under each one. Each row is one copy and
// its repeat, moved by exactly one copy (globals.css, cup-marquee); a hand
// or a keyboard on a row stops it. Tapping a card goes to the store.
export default function BrandsMarquee({ brands }: { brands: CuponeraBrandCard[] }) {
  const seen = new Set<string>();
  return (
    <div className="cup-marquee" aria-label="Marcas con descuento">
      {rowsOf(brands).map((row, r) => {
        const seconds = Math.round(row.length * SECONDS_PER_CARD * ROW_SPEEDS[r % ROW_SPEEDS.length]!);
        return (
          <div key={r} className="cup-marquee-row">
            <div className="cup-marquee-track" style={{ animationDuration: `${seconds}s`, animationDelay: `-${(r * 7) % seconds}s` }}>
              {[...row, ...row].map((b, i) => {
                // Only a brand's first card is for keyboards and screen readers.
                const hidden = seen.has(b.id);
                seen.add(b.id);
                return (
                  <BrandLink key={`${b.id}-${i}`} brand={b} className="cup-mcard" hidden={hidden}>
                    <span className={`cup-mcard-logo cup-mcard-logo--${b.logoUrl ? "img" : b.tone}`}>
                      {b.logoUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- logo hosted by Marcolini */}
                          <img src={b.logoUrl} alt="" loading="lazy" decoding="async" />
                          <span className="cup-sr">{b.name}</span>
                        </>
                      ) : (
                        <span className="cup-mcard-name">{b.name}</span>
                      )}
                    </span>
                    <span className="cup-mcard-offer">{formatPercent(b.discountPercent)} de descuento</span>
                  </BrandLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
