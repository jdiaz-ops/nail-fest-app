"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import BrandCoupon from "./BrandCoupon";
import { CODES_ONLY_ONLINE } from "./CuponeraFooter";
import { collectionHref, type CuponeraCategoryLink } from "@/lib/cuponera/browse";
import { normalizeText, type CuponeraBrandCard } from "@/lib/cuponera/shared";

// The cuponera's header: the logo (back to the front page) and the ☰ menu
// with two tabs — first every brand as a coupon (its %, its code, the way to
// its store), then the categories and their types, each opening its
// collection. Nothing here leads to the rest of nailfest.lat.
export default function CuponeraHeader({ brands, categories }: { brands: CuponeraBrandCard[]; categories: CuponeraCategoryLink[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"marcas" | "categorias">("marcas");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...brands].sort((a, b) => a.name.localeCompare(b.name, "es")), [brands]);
  const q = normalizeText(query);
  const shown = q ? sorted.filter((b) => normalizeText(b.name).includes(q)) : sorted;

  const close = () => dialogRef.current?.close();

  return (
    <header className="cup-header">
      <div className="cup-header-inner">
        <Link href="/cuponera" className="cup-brand" aria-label="Cuponera Nail Fest, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img src="/logo.png" alt="Nail Fest" />
          <span>Cuponera</span>
        </Link>
        <button type="button" className="cup-burger" aria-label="Abrir el menú: marcas y categorías" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="cup-menu"
        aria-label="Menú de la cuponera"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="cup-menu-top">
          <span className="cup-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="" />
            <span>Cuponera</span>
          </span>
          <button type="button" className="cup-menu-close" onClick={close} aria-label="Cerrar el menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="cup-menu-body">
          <div className="cup-tabs" role="tablist" aria-label="Ver">
            <button type="button" role="tab" aria-selected={tab === "marcas"} className={tab === "marcas" ? "cup-tab is-on" : "cup-tab"} onClick={() => setTab("marcas")}>
              Marcas
            </button>
            <button type="button" role="tab" aria-selected={tab === "categorias"} className={tab === "categorias" ? "cup-tab is-on" : "cup-tab"} onClick={() => setTab("categorias")}>
              Categorías
            </button>
          </div>

          {tab === "categorias" ? (
            <div role="tabpanel">
              <p className="cup-menu-intro">Lo de todas las marcas, por categoría.</p>
              {categories.length === 0 && <p className="cup-menu-intro">Todavía no hay productos.</p>}
              {categories.map((c) => (
                <div key={c.key} className="cup-menu-cat">
                  <div className="cup-menu-cat-head">
                    <Link href={collectionHref(c.key)} onClick={close} className="cup-menu-cat-name">
                      {c.label}
                    </Link>
                    <Link href={collectionHref(c.key)} onClick={close} className="cup-menu-all">
                      Ver todo
                    </Link>
                  </div>
                  {c.subcategories.length > 0 && (
                    <div className="cup-menu-subs">
                      {c.subcategories.map((s) => (
                        <Link key={s.key} href={collectionHref(c.key, s.key)} onClick={close} className="cup-chip cup-chip--small">
                          {s.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div role="tabpanel">
              <ol className="cup-steps">
                <li>
                  <b>Toca una marca:</b> copiamos su código y abrimos su tienda.
                </li>
                <li>
                  <b>Elige tus productos</b> en la tienda de la marca.
                </li>
                <li>
                  <b>Al pagar,</b> si el descuento no aparece solo, pega el código.
                </li>
              </ol>
              <p className="cup-menu-note">{CODES_ONLY_ONLINE}</p>
              {sorted.length > 6 && (
                <div className="cup-menu-search">
                  <label htmlFor="cup-brand-q" className="cup-sr">
                    Buscar una marca
                  </label>
                  <input id="cup-brand-q" type="search" value={query} placeholder="Busca una marca" autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
                </div>
              )}
              {shown.length === 0 && <p className="cup-menu-intro">Ninguna marca se llama así.</p>}
              <div className="cup-menu-coupons">
                {shown.map((b, i) => {
                  // Letters only help once the list is long.
                  const letter = b.name.trim().charAt(0).toUpperCase();
                  const prev = shown[i - 1]?.name.trim().charAt(0).toUpperCase();
                  return (
                    <div key={b.id} className="cup-menu-coupon">
                      {sorted.length > 8 && letter !== prev && <div className="cup-menu-letter">{letter}</div>}
                      <BrandCoupon brand={b} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </header>
  );
}
