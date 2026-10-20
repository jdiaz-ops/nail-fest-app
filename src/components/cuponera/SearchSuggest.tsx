"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./BrandLink";
import ProductIcon from "./ProductIcon";
import { CATEGORY_ART } from "./categoryArt";
import { highlightParts, popularSuggestions, rankSuggestions, type CuponeraSuggestion } from "@/lib/cuponera/browse";

const GROUPS: { kind: CuponeraSuggestion["kind"]; label: string }[] = [
  { kind: "marca", label: "Marcas" },
  { kind: "categoria", label: "Categorías" },
  { kind: "producto", label: "Productos" },
];

// The front page's search box. Focused and empty, it offers real things to
// look for (the biggest brands and categories); while typing, the brands
// (with their discount and code), categories and products that match, the
// match in bold. Enter without picking one searches it all (/cuponera/buscar).
export default function SearchSuggest({ index }: { index: CuponeraSuggestion[] }) {
  const router = useRouter();
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = query.trim().length > 0;
  const results = useMemo(() => (typed ? rankSuggestions(index, query) : []), [index, query, typed]);
  const popular = useMemo(() => popularSuggestions(index), [index]);
  const showing = open && (typed ? results.length > 0 : popular.length > 0);

  // A tap anywhere else closes it.
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter" && showing && active >= 0 && results[active]) {
      e.preventDefault();
      router.push(results[active]!.href);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form ref={boxRef} className="cup-search cup-search--suggest" role="search" action="/cuponera/buscar" method="get">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="cup-q" className="cup-sr">
        Buscar productos
      </label>
      <input
        ref={inputRef}
        id="cup-q"
        name="q"
        type="search"
        placeholder="Busca marcas, productos o categorías"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {typed && (
        <button
          type="button"
          className="cup-search-clear"
          aria-label="Borrar la búsqueda"
          onClick={() => {
            setQuery("");
            setActive(-1);
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      )}
      {showing && (
        <div className="cup-suggest">
          {typed ? (
            <ul id={listId} role="listbox" aria-label="Sugerencias">
              {GROUPS.map((group) => {
                const items = results.map((s, i) => ({ s, i })).filter((e) => e.s.kind === group.kind);
                if (items.length === 0) return null;
                return (
                  <li key={group.kind} role="presentation">
                    <span className="cup-suggest-group" aria-hidden="true">
                      {group.label}
                    </span>
                    <ul role="group" aria-label={group.label}>
                      {items.map(({ s, i }) => (
                        <li
                          key={s.href}
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          className={i === active ? "cup-suggest-item is-on" : "cup-suggest-item"}
                          // Keep the focus in the box until the tap lands.
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => router.push(s.href)}
                        >
                          <SuggestionIcon suggestion={s} />
                          <span className="cup-suggest-text">
                            <span className="cup-suggest-label">
                              {highlightParts(s.label, query).map(([text, bold], k) => (bold ? <b key={k}>{text}</b> : <span key={k}>{text}</span>))}
                            </span>
                            <small>{s.detail}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div id={listId} className="cup-suggest-popular">
              <span className="cup-suggest-group">Prueba con</span>
              <div className="cup-chips cup-chips--wrap">
                {popular.map((s) => (
                  <Link key={s.href} href={s.href} className="cup-chip cup-chip--small">
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function SuggestionIcon({ suggestion }: { suggestion: CuponeraSuggestion }) {
  if (suggestion.logo) return <BrandLogo brand={suggestion.logo} size="xs" />;
  if (suggestion.category) {
    const art = CATEGORY_ART[suggestion.category];
    return (
      <span className="cup-suggest-icon" style={{ background: art.background }} aria-hidden="true">
        <ProductIcon kind={art.icon} color={art.color} size={22} />
      </span>
    );
  }
  return (
    <span className="cup-suggest-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </span>
  );
}
