"use client";

import { useState } from "react";
import PreviewLink from "./PreviewLink";
import { discountPercent, formatCop, type CuponeraDesign } from "@/lib/cuponera/shared";

// Where each numbered pin sits on the drawn tips (px inside .cup-nails).
const PINS = [
  { left: 10, top: 64 },
  { left: 73, top: 40 },
  { left: 138, top: 26 },
  { left: 203, top: 44 },
];

// "Compra este diseño" (LTK's shop-the-look): a nail design with a
// numbered pin per product used; a pin or a row opens that product.
export default function ShopTheDesign({ design, displayClassName }: { design: CuponeraDesign; displayClassName: string }) {
  const [selected, setSelected] = useState(0);
  const total = design.items.reduce((sum, it) => sum + it.price, 0);
  const totalBefore = design.items.reduce((sum, it) => sum + it.before, 0);

  return (
    <section className="cup-section">
      <div className="cup-section-head">
        <div className="cup-eyebrow cup-eyebrow--pink">Compra este diseño</div>
        <h2 className={`cup-h2 ${displayClassName}`}>{design.headline}</h2>
      </div>
      <div className="cup-design">
        <div className="cup-design-art">
          <div className="cup-nails">
            <span className="cup-nail cup-nail-1" aria-hidden="true" />
            <span className="cup-nail cup-nail-2" aria-hidden="true" />
            <span className="cup-nail cup-nail-3" aria-hidden="true" />
            <span className="cup-nail cup-nail-4" aria-hidden="true" />
            <span className="cup-nail cup-nail-5" aria-hidden="true" />
            {design.items.map((it, i) => (
              <button
                key={it.name}
                type="button"
                className={i === selected ? "cup-pin is-on" : "cup-pin"}
                style={PINS[i]}
                aria-pressed={i === selected}
                aria-label={`Producto ${i + 1}: ${it.name}`}
                onClick={() => setSelected(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <span className="cup-design-hint">Toca un número para ver el producto</span>
        </div>
        <div className="cup-design-list">
          {design.items.map((it, i) =>
            i === selected ? (
              <div key={it.name} className="cup-row-open">
                <div className="cup-row">
                  <span className="cup-row-n">{i + 1}</span>
                  <span className="cup-row-swatch" style={{ background: it.color }} />
                  <span className="cup-row-text">
                    <span className="cup-row-name">{it.name}</span>
                    <span className="cup-row-brand">{it.brand} · con el código NAILFEST</span>
                  </span>
                  <span className="cup-row-prices">
                    <span className="cup-price">{formatCop(it.price)}</span>
                    {discountPercent(it.price, it.before) > 0 && <span className="cup-before">{formatCop(it.before)}</span>}
                  </span>
                </div>
                <PreviewLink
                  href={it.url}
                  preview={`Vista previa: aquí se abriría ${it.name} en la tienda de ${it.brand}, con el código NAILFEST.`}
                  className="cup-btn cup-btn--small"
                >
                  Ver en la tienda de {it.brand}
                </PreviewLink>
              </div>
            ) : (
              <button key={it.name} type="button" className="cup-row" onClick={() => setSelected(i)}>
                <span className="cup-row-n">{i + 1}</span>
                <span className="cup-row-swatch" style={{ background: it.color }} />
                <span className="cup-row-text">
                  <span className="cup-row-name">{it.name}</span>
                  <span className="cup-row-brand">{it.brand}</span>
                </span>
                <span className="cup-row-prices">
                  <span className="cup-price">{formatCop(it.price)}</span>
                  {discountPercent(it.price, it.before) > 0 && <span className="cup-before">{formatCop(it.before)}</span>}
                </span>
              </button>
            ),
          )}
          <div className="cup-total">
            <span>Los {design.items.length} productos con Nail Fest</span>
            <span className="cup-total-amounts">
              <b>{formatCop(total)}</b>
              <span>Ahorras {formatCop(totalBefore - total)}</span>
            </span>
          </div>
          <span className="cup-credit">{design.credit} · Cada producto se compra en la tienda de su marca.</span>
        </div>
      </div>
    </section>
  );
}
