"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import ProductTiles from "./ProductTiles";
import { colorSwatch, type CuponeraProduct } from "@/lib/cuponera/shared";
import { colorsPresent, groupByLine, searchScore, searchWords, sizesPresent, sortOptions, sortTiles, type CuponeraSort } from "@/lib/cuponera/browse";

export interface CollectionType {
  label: string;
  href: string;
  active: boolean;
}

// A collection page's body (a category, a type, a list, a search): the
// types to jump to, the filters — color, brand, size — and the sort, then
// every product of every brand, the tones of a line in one card.
export default function CollectionView({
  products,
  types = [],
  search = false,
  initialQuery = "",
  emptyText,
  displayClassName,
}: {
  products: CuponeraProduct[];
  types?: CollectionType[];
  /** The search page: a box on top that narrows everything as you type. */
  search?: boolean;
  initialQuery?: string;
  emptyText: string;
  displayClassName: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [color, setColor] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [sort, setSort] = useState<CuponeraSort>("recomendados");
  const [moreFilters, setMoreFilters] = useState(false);
  const colorLabelId = useId();
  const brandLabelId = useId();
  const sizeLabelId = useId();

  // The search first (best matches first), then the filters.
  const base = useMemo(() => {
    if (!search) return products;
    const words = searchWords(query);
    return products
      .map((product, index) => ({ product, index, score: searchScore(product, words) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((e) => e.product);
  }, [products, search, query]);

  const match = (p: CuponeraProduct, skip: "color" | "brand" | "size") =>
    (skip === "brand" || !brand || p.brand === brand) && (skip === "color" || !color || p.colorFamily === color) && (skip === "size" || !size || p.size === size);

  // Each filter offers what the others leave; the one picked stays on screen.
  const colors = colorsPresent(base.filter((p) => match(p, "color")));
  if (color && !colors.some((c) => c.name === color)) colors.push({ name: color, swatch: colorSwatch(color) ?? "#ffffff", count: 0 });
  const brandCounts = new Map<string, number>();
  for (const p of base.filter((p) => match(p, "brand"))) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const brands = [...brandCounts.keys()].sort((a, b) => a.localeCompare(b, "es"));
  if (brand && !brands.includes(brand)) brands.push(brand);
  const sizes = sizesPresent(base.filter((p) => match(p, "size")));
  if (size && !sizes.includes(size)) sizes.push(size);

  const results = base.filter((p) => match(p, "color") && match(p, "brand") && match(p, "size"));
  const sorts = sortOptions(base);
  const activeSort = sorts.some((o) => o.key === sort) ? sort : "recomendados";
  const tiles = sortTiles(groupByLine(results), activeSort);
  const filtered = color !== null || brand !== null || size !== null;
  const showSizes = sizes.length >= 2 || size !== null;

  function changeQuery(value: string) {
    setQuery(value);
    // The address keeps the search, for going back or sharing it.
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  function clearFilters() {
    setColor(null);
    setBrand(null);
    setSize(null);
  }

  return (
    <div className="cup-collection">
      {search && (
        <form className="cup-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label htmlFor="cup-q" className="cup-sr">
            Buscar productos
          </label>
          <input id="cup-q" type="search" value={query} onChange={(e) => changeQuery(e.target.value)} placeholder="Busca marcas, productos o categorías" autoComplete="off" autoFocus={!initialQuery} />
          {query && (
            <button type="button" className="cup-search-clear" onClick={() => changeQuery("")} aria-label="Borrar la búsqueda">
              ✕
            </button>
          )}
        </form>
      )}

      {types.length > 0 && (
        <nav className="cup-chips" aria-label="Tipos">
          {types.map((t) => (
            <Link key={t.href} href={t.href} className={t.active ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"} aria-current={t.active ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      {(showSizes || (results.length > 1 && sorts.length > 1)) && (
        <div className="cup-toolbar">
          {showSizes && (
            <button type="button" className="cup-tool" aria-expanded={moreFilters} onClick={() => setMoreFilters((v) => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filtros
              {size && <span className="cup-tool-count">1</span>}
            </button>
          )}
          {results.length > 1 && sorts.length > 1 && (
            <label className="cup-tool cup-tool--sort">
              <span>Ordenar:</span>
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
      )}

      {showSizes && (moreFilters || size) && (
        <div className="cup-filter">
          <span className="cup-filter-label" id={sizeLabelId}>
            Tamaño
          </span>
          <div className="cup-chips" role="group" aria-labelledby={sizeLabelId}>
            {sizes.map((s) => (
              <button key={s} type="button" className={s === size ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"} aria-pressed={s === size} onClick={() => setSize(s === size ? null : s)}>
                {s}
              </button>
            ))}
          </div>
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

      {(brands.length >= 2 || brand) && (
        <div className="cup-filter">
          <span className="cup-filter-label" id={brandLabelId}>
            Marca
          </span>
          <div className="cup-chips" role="group" aria-labelledby={brandLabelId}>
            <button type="button" className={brand === null ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"} aria-pressed={brand === null} onClick={() => setBrand(null)}>
              Todas
            </button>
            {brands.map((b) => (
              <button key={b} type="button" className={b === brand ? "cup-chip cup-chip--small is-on" : "cup-chip cup-chip--small"} aria-pressed={b === brand} onClick={() => setBrand(b === brand ? null : b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {(filtered || search) && (
        <p className="cup-sub cup-collection-count" aria-live="polite">
          {results.length === 1 ? "1 producto" : `${results.length} productos`}
          {filtered && results.length !== base.length ? ` de ${base.length}` : ""}
        </p>
      )}

      {tiles.length > 0 ? (
        <ProductTiles tiles={tiles} displayClassName={displayClassName} />
      ) : (
        <p className="cup-empty">{filtered ? "Ningún producto tiene esa combinación de filtros." : search && query.trim() ? "No encontramos productos con esa búsqueda. Prueba con otra palabra." : emptyText}</p>
      )}
      {filtered && (
        <button type="button" className="cup-linkbtn" onClick={clearFilters}>
          Quitar los filtros
        </button>
      )}
    </div>
  );
}
