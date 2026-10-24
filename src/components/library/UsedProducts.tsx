"use client";

import { showCuponeraNotice } from "@/components/cuponera/PreviewLink";
import ProductIcon from "@/components/cuponera/ProductIcon";
import { formatPercent } from "@/lib/cuponera/shared";
import type { UsedProduct } from "@/lib/library/shared";

// "Lo que usó": each product of the video. From the cuponera it carries
// the discount and the code, and "Comprar" opens the brand's store with the
// code copied on the way (pasted at checkout when the link doesn't apply it
// by itself) — the same way out as every brand in the cuponera.
export default function UsedProducts({ products, buyLabel }: { products: UsedProduct[]; buyLabel: string }) {
  return (
    <div className="bib-used">
      {products.map((p) => (
        <div key={p.key} className="bib-used-item">
          <span className="bib-used-img" style={{ background: p.tint }} aria-hidden="true">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- product photo hosted by the brand's store
              <img src={p.imageUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <ProductIcon kind={p.icon} color={p.color} size={34} />
            )}
          </span>
          <span className="bib-used-text">
            <b>{p.name}</b>
            <small>
              {p.brand}
              {p.discountPercent != null && p.code && (
                <>
                  {" "}
                  · {formatPercent(p.discountPercent)} con el código <code className="cup-code-chip">{p.code}</code>
                </>
              )}
            </small>
          </span>
          {p.code &&
            (p.url ? (
              <a
                href={p.url}
                target="_blank"
                rel="noopener"
                className="bib-btn bib-btn-main bib-btn-sm"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(p.code!)
                    .then(() => showCuponeraNotice(`Copiamos el código ${p.code}. Si la tienda no lo aplica sola, pégalo al pagar.`))
                    .catch(() => {
                      // Clipboard blocked: the code is on screen to type at checkout.
                    });
                }}
              >
                {buyLabel}
              </a>
            ) : (
              <button
                type="button"
                className="bib-btn bib-btn-main bib-btn-sm"
                onClick={() => showCuponeraNotice(`Ejemplo: aquí se abriría la tienda de ${p.brand} con el código ${p.code} copiado.`)}
              >
                {buyLabel}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
