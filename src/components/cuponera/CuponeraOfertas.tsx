"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import ProductTiles from "./ProductTiles";
import {
  CUPONERA_CATEGORIES,
  CUPONERA_PROFESSIONS,
  categoryLabel,
  colorSwatch,
  type CuponeraCategory,
  type CuponeraProduct,
  type CuponeraProfession,
} from "@/lib/cuponera/shared";
import {
  categoriesPresent,
  colorsPresent,
  groupByLine,
  searchScore,
  searchWords,
  sizesPresent,
  sortOptions,
  sortTiles,
  subcategoriesPresent,
  type CuponeraSort,
} from "@/lib/cuponera/browse";

// How many cards the profession grid shows before "Ver todas".
const PROFESSION_PREVIEW = 8;

// The top of the cuponera: the promise, the search box and the category
// chips, then either the results — with the filters for type, color and
// size and the sort — or the deal of the day plus the offers for the
// visitor's profession. One client island because the search, the chips,
// the filters and the grid share their state.
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
  // null = the start (deal of the day + offers by profession); "todo" =
  // every product; a category = its products.
  const [category, setCategory] = useState<"todo" | CuponeraCategory | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [sort, setSort] = useState<CuponeraSort>("recomendados");
  const [profession, setProfession] = useState<CuponeraProfession>("mani");
  const [showAll, setShowAll] = useState(false);
  const colorLabelId = useId();
  const sizeLabelId = useId();

  const q = query.trim();
  const filtering = q !== "" || category !== null;
  const specific = category !== null && category !== "todo" ? category : null;
  const categoryName = specific ? categoryLabel(specific) : null;

  // Only the categories that have something.
  const chips = useMemo(() => {
    const present = new Set<string>(categoriesPresent(products));
    return CUPONERA_CATEGORIES.filter((c) => c.key === "todo" || present.has(c.key));
  }, [products]);

  // The search and the category; best matches first, then the admin's order.
  const inCategory = useMemo(() => {
    const words = searchWords(q);
    return products
      .map((product, index) => ({ product, index, score: searchScore(product, words) }))
      .filter((entry) => entry.score > 0 && (!specific || entry.product.category === specific))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.product);
  }, [products, q, specific]);

  const subcategories = specific ? subcategoriesPresent(inCategory, specific) : [];
  const showSubcategories =
    subcategory !== null ||
    subcategories.length >= 2 ||
    (subcategories.length === 1 && inCategory.some((p) => p.subcategory !== subcategories[0]!.key));
  const base = subcategory ? inCategory.filter((p) => p.subcategory === subcategory) : inCategory;

  // Each filter offers what the other one leaves; the one picked always
  // stays on screen, so it can be taken off.
  const colors = colorsPresent(size ? base.filter((p) => p.size === size) : base);
  if (color && !colors.some((c) => c.name === color)) colors.push({ name: color, swatch: colorSwatch(color) ?? "#ffffff", count: 0 });
  const sizes = specific ? sizesPresent(color ? base.filter((p) => p.colorFamily === color) : base) : [];
  if (size && !sizes.includes(size)) sizes.push(size);

  const results = base.filter((p) => (!color || p.colorFamily === color) && (!size || p.size === size));
  const sorts = sortOptions(base);
  const activeSort = sorts.some((o) => o.key === sort) ? sort : "recomendados";
  const tiles = sortTiles(groupByLine(results), activeSort);
  const narrowed = subcategory !== null || color !== null || size !== null;

  const resultsTitle = q ? `Resultados para «${q}»` : (categoryName ?? "Toda la cuponera");
  const countText = `${results.length === 1 ? "1 producto" : `${results.length} productos`}${q && categoryName ? ` en ${categoryName}` : ""}`;

  // A product with no professions picked is for everyone.
  const professionTiles = groupByLine(products.filter((p) => p.professions.length === 0 || p.professions.includes(profession)));
  const professionShown = showAll ? professionTiles : professionTiles.slice(0, PROFESSION_PREVIEW);
  const professionPlural = CUPONERA_PROFESSIONS.find((p) => p.key === profession)?.plural ?? "manicuristas";

  function clearFilters() {
    setSubcategory(null);
    setColor(null);
    setSize(null);
  }

  // The chip already on goes back to the start.
  function pickCategory(key: "todo" | CuponeraCategory) {
    setCategory((current) => (current === key ? null : key));
    clearFilters();
  }

  function backToStart() {
    setQuery("");
    setCategory(null);
    clearFilters();
    setSort("recomendados");
  }

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
              placeholder="Busca gel, lámpara, un tono…"
              autoComplete="off"
            />
            {query && (
              <button type="button" className="cup-search-clear" onClick={() => setQuery("")} aria-label="Borrar la búsqueda">
                ✕
              </button>
            )}
          </form>
          <div className="cup-chips" role="group" aria-label="Categorías">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={c.key === category ? "cup-chip is-on" : "cup-chip"}
                aria-pressed={c.key === category}
                title={c.label}
                onClick={() => pickCategory(c.key)}
              >
                {c.chip}
              </button>
            ))}
          </div>
        </div>
        {!filtering && deal && <div className="cup-hero-side">{deal}</div>}
      </section>

      {filtering ? (
        <section className="cup-section">
          <div className="cup-section-head cup-section-head--split">
            <div className="cup-section-head">
              <h2 className={`cup-h2 ${displayClassName}`}>{resultsTitle}</h2>
              <p className="cup-sub" aria-live="polite">
                {countText}
              </p>
            </div>
            {results.length > 1 && sorts.length > 1 && (
              <label className="cup-sort">
                <span>Ordenar por</span>
                <select value={activeSort} onChange={(e) => setSort(e.target.value as CuponeraSort)}>
                  {sorts.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {specific && showSubcategories && (
            <div className="cup-chips" role="group" aria-label={`Tipos de ${categoryName}`}>
              <button
                type="button"
                className={subcategory === null ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"}
                aria-pressed={subcategory === null}
                onClick={() => setSubcategory(null)}
              >
                Todo
              </button>
              {subcategories.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={s.key === subcategory ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"}
                  aria-pressed={s.key === subcategory}
                  onClick={() => setSubcategory(s.key === subcategory ? null : s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {(colors.length >= 2 || color) && (
            <div className="cup-filter">
              <span className="cup-filter-label" id={colorLabelId}>
                Color{color ? `: ${color}` : ""}
              </span>
              <div className="cup-swatches" role="group" aria-labelledby={colorLabelId}>
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={c.name === color ? "cup-swatch is-on" : "cup-swatch"}
                    style={{ background: c.swatch }}
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={c.name === color}
                    onClick={() => setColor(c.name === color ? null : c.name)}
                  />
                ))}
              </div>
              {color && (
                <button type="button" className="cup-filter-clear" onClick={() => setColor(null)}>
                  Quitar
                </button>
              )}
            </div>
          )}

          {(sizes.length >= 2 || size) && (
            <div className="cup-filter">
              <span className="cup-filter-label" id={sizeLabelId}>
                Tamaño
              </span>
              <div className="cup-chips" role="group" aria-labelledby={sizeLabelId}>
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={s === size ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"}
                    aria-pressed={s === size}
                    onClick={() => setSize(s === size ? null : s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tiles.length > 0 ? (
            <ProductTiles tiles={tiles} displayClassName={displayClassName} />
          ) : (
            <p className="cup-empty">
              {narrowed
                ? "Ningún producto tiene esa combinación de filtros."
                : "No encontramos productos con esa búsqueda. Prueba con otra palabra o elige otra categoría."}
            </p>
          )}
          <div className="cup-linkrow">
            {narrowed && (
              <button type="button" className="cup-linkbtn" onClick={clearFilters}>
                Quitar los filtros
              </button>
            )}
            <button type="button" className="cup-linkbtn" onClick={backToStart}>
              Volver al inicio de la cuponera
            </button>
          </div>
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
          <ProductTiles tiles={professionShown} displayClassName={displayClassName} />
          {professionTiles.length > professionShown.length && (
            <button type="button" className="cup-linkbtn" onClick={() => setShowAll(true)}>
              Ver todas las ofertas para {professionPlural} ({professionTiles.length})
            </button>
          )}
        </section>
      )}
    </>
  );
}
