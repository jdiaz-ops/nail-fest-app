"use client";

import type { ReactNode } from "react";
import { showCuponeraNotice } from "./PreviewLink";
import type { CuponeraBrandCard } from "@/lib/cuponera/shared";

// A brand's logo from its Marcolini profile, or its initial.
export function BrandLogo({ brand, size = "md" }: { brand: Pick<CuponeraBrandCard, "logoUrl" | "initial" | "tone">; size?: "xs" | "sm" | "md" }) {
  return (
    <span className={`cup-logo cup-logo--${size} cup-logo--${brand.tone}`} aria-hidden="true">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo hosted by Marcolini
        <img src={brand.logoUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        brand.initial
      )}
    </span>
  );
}

// Every brand on the page is a way out to its store: the code is copied on
// the way (pasted at checkout when the link doesn't apply it by itself) and
// the store opens in a new tab. In the sample preview it only explains.
export default function BrandLink({
  brand,
  className,
  hidden = false,
  children,
}: {
  brand: CuponeraBrandCard;
  className?: string;
  /** A repeat (the sliding logos loop): skipped by keyboards and screen readers. */
  hidden?: boolean;
  children: ReactNode;
}) {
  const repeat = hidden ? { "aria-hidden": true, tabIndex: -1 } : {};
  const copy = () => {
    navigator.clipboard
      ?.writeText(brand.code)
      .then(() => showCuponeraNotice(`Copiamos el código ${brand.code}. Si la tienda no lo aplica sola, pégalo al pagar.`))
      .catch(() => {
        // Clipboard blocked: the code is on screen to type at checkout.
      });
  };
  if (!brand.storeUrl) {
    return (
      <a
        href="#"
        className={className}
        {...repeat}
        onClick={(e) => {
          e.preventDefault();
          showCuponeraNotice(`Vista previa: aquí se abriría la tienda de ${brand.name} con el código ${brand.code} copiado.`);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={brand.storeUrl} target="_blank" rel="noopener" className={className} onClick={copy} {...repeat}>
      {children}
    </a>
  );
}
