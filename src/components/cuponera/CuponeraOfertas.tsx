"use client";

import { useMemo, useState, type ReactNode } from "react";
import ProductCard from "./ProductCard";
import {
  CUPONERA_CATEGORIES,
  CUPONERA_PROFESSIONS,
  type CuponeraCategory,
  type CuponeraProduct,
  type CuponeraProfession,
} from "@/lib/cuponera/shared";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// How many offers the profession grid shows before "Ver todas".
const PROFESSION_PREVIEW = 8;

// The top of the cuponera: the promise, the search box and the category
// chips, then either the search results or the deal of the day plus the
// offers for the visitor's profession. One client island because the
// search, the chips and the grid share their state.
export default function CuponeraOfertas({
  products,
  deal,
  title,
  lede,
  displayClassName,
}: {
  products: CuponeraProduct[];
  deal: ReactNode;
  title: string;
  lede: string;
  displayClassName: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"todo" | CuponeraCategory>("todo");
  const [profession, setProfession] = useState<CuponeraProfession>("mani");
  const [showAll, setShowAll] = useState(false);

  const filtering = query.trim() !== "" || category !== "todo";
  const results = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter(
      (p) => (category === "todo" || p.category === category) && (!q || normalize(`${p.name} ${p.brand}`).includes(q)),
    );
  }, [products, query, category]);
  // A product with no professions picked is for everyone.
  const forProfession = products.filter((p) => p.professions.length === 0 || p.professions.includes(profession));
  const professionShown = showAll ? forProfession : forProfession.slice(0, PROFESSION_PREVIEW);
  const professionPlural = CUPONERA_PROFESSIONS.find((p) => p.key === profession)?.plural ?? "manicuristas";
  const categoryLabel = CUPONERA_CATEGORIES.find((c) => c.key === category)?.label ?? "";
  const resultsTitle = query.trim() ? `Resultados para «${query.trim()}»` : categoryLabel;

  return (
    <>
      <section className="cup-hero">
        <div className="cup-hero-main">
          <div className="cup-eyebrow">Cuponera Nail Fest</div>
          <h1 className={`cup-title ${displayClassName}`}>{title}</h1>
          <p className="cup-lede">{lede}</p>
          <form className="cup-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <label htmlFor="cup-q" className="cup-sr">
              Buscar productos
            </label>
            <input
              id="cup-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca gel, lámpara, tips…"
              autoComplete="off"
            />
            {query && (
              <button type="button" className="cup-search-clear" onClick={() => setQuery("")} aria-label="Borrar la búsqueda">
                ✕
              </button>
            )}
          </form>
          <div className="cup-chips" role="group" aria-label="Categorías">
            {CUPONERA_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={c.key === category ? "cup-chip is-on" : "cup-chip"}
                aria-pressed={c.key === category}
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {!filtering && deal && <div className="cup-hero-side">{deal}</div>}
      </section>

      {filtering ? (
        <section className="cup-section" aria-live="polite">
          <div className="cup-section-head">
            <h2 className={`cup-h2 ${displayClassName}`}>{resultsTitle}</h2>
            <p className="cup-sub">{results.length === 1 ? "1 producto" : `${results.length} productos`}</p>
          </div>
          {results.length > 0 ? (
            <div className="cup-grid">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="cup-empty">No encontramos productos con esa búsqueda. Prueba con otra palabra o elige otra categoría.</p>
          )}
          <button
            type="button"
            className="cup-linkbtn"
            onClick={() => {
              setQuery("");
              setCategory("todo");
            }}
          >
            Ver toda la cuponera
          </button>
        </section>
      ) : (
        <section className="cup-section">
          <div className="cup-section-head cup-section-head--split">
            <div className="cup-section-head">
              <h2 className={`cup-h2 ${displayClassName}`}>Ofertas para lo que haces</h2>
              <p className="cup-sub">Elige y te mostramos lo que más compra gente como tú.</p>
            </div>
            <div className="cup-chips cup-chips--wrap" role="group" aria-label="¿Qué haces?">
              {CUPONERA_PROFESSIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={p.key === profession ? "cup-chip cup-chip--prof is-on" : "cup-chip cup-chip--prof"}
                  aria-pressed={p.key === profession}
                  onClick={() => {
                    setProfession(p.key);
                    setShowAll(false);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cup-grid">
            {professionShown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {forProfession.length > professionShown.length && (
            <button type="button" className="cup-linkbtn" onClick={() => setShowAll(true)}>
              Ver todas las ofertas para {professionPlural} ({forProfession.length})
            </button>
          )}
        </section>
      )}
    </>
  );
}
