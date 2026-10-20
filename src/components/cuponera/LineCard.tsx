"use client";

import { useId, useRef } from "react";
import ProductPhoto from "./ProductPhoto";
import PreviewLink from "./PreviewLink";
import Rating from "./Rating";
import { lastUnitsText, RankBadge } from "./ProductCard";
import { cheapest, combinedRating, lineCountLabel, toneName, type CuponeraLine } from "@/lib/cuponera/browse";
import { colorSwatch, discountPercent, formatCop } from "@/lib/cuponera/shared";

// How many color dots the card shows (one per color family in the line).
const MAX_DOTS = 6;

// Every tone of a line in one card ("Gel Polish · 24 tonos", Sephora's
// shade count): the cheapest price, the line's reviews together and its
// colors. Opening it lists the tones, each one to its own store page.
export default function LineCard({ line, rank, displayClassName = "" }: { line: CuponeraLine; rank?: number; displayClassName?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const first = line.members[0]!;
  const low = cheapest(line.members);
  const priceFrom = line.members.some((p) => p.priceFrom || p.price !== low.price);
  const off = Math.max(...line.members.map((p) => discountPercent(p.price, p.before)));
  const lowOff = discountPercent(low.price, low.before);
  const rating = combinedRating(line.members);
  const count = lineCountLabel(line);
  const dots = [...new Set(line.members.map((p) => colorSwatch(p.colorFamily)).filter((s): s is string => Boolean(s)))].slice(0, MAX_DOTS);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="cup-card cup-card--line" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        <span className="cup-card-photo" style={{ background: first.tint }}>
          {off > 0 && <span className="cup-off">−{off} %</span>}
          {rank != null && <RankBadge rank={rank} />}
          <ProductPhoto product={first} size={66} />
        </span>
        <span className="cup-card-body">
          <span className="cup-brandname">{line.brand}</span>
          <span className="cup-card-name">{line.name}</span>
          <span className="cup-card-meta">
            {dots.length > 0 && (
              <span className="cup-dots" aria-hidden="true">
                {dots.map((swatch) => (
                  <span key={swatch} className="cup-dot" style={{ background: swatch }} />
                ))}
              </span>
            )}
            <span>{count}</span>
            {rating && <Rating rating={rating} />}
          </span>
          <span className="cup-prices">
            <span className="cup-price">
              {priceFrom && <span className="cup-from">Desde </span>}
              {formatCop(low.price)}
            </span>
            {lowOff > 0 && <span className="cup-before">{formatCop(low.before)}</span>}
          </span>
          <span className="cup-card-code">
            con el código <b className="cup-mono">{first.code}</b>
          </span>
          <span className="cup-card-cta">Ver los {count}</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="cup-sheet cup-sheet--tones"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="cup-sheet-body">
          <div className="cup-sheet-handle" aria-hidden="true" />
          <div className="cup-sheet-top cup-sheet-top--start">
            <div className="cup-sheet-head">
              <span className="cup-brandname">{line.brand}</span>
              <h2 id={titleId} className={`cup-sheet-linetitle ${displayClassName}`}>
                {line.name}
              </h2>
              <span className="cup-sheet-note">
                {count} · con el código <b className="cup-mono">{first.code}</b>
              </span>
            </div>
            <button type="button" className="cup-sheet-close" onClick={close} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <ul className="cup-tones">
            {line.members.map((p) => {
              const tone = toneName(p, line.name);
              const toneOff = discountPercent(p.price, p.before);
              const swatch = colorSwatch(p.colorFamily);
              const lastUnits = lastUnitsText(p.unitsLeft);
              return (
                <li key={p.id}>
                  <PreviewLink
                    href={p.url}
                    preview={`Vista previa: aquí se abriría ${p.name} en la tienda de ${p.brand}, con el código ${p.code}.`}
                    className="cup-tone"
                  >
                    <span className="cup-tone-photo" style={{ background: p.tint }}>
                      <ProductPhoto product={p} size={34} />
                    </span>
                    <span className="cup-tone-text">
                      <span className="cup-tone-name">{tone}</span>
                      <span className="cup-tone-meta">
                        {swatch && (
                          <span className="cup-tone-color">
                            <span className="cup-dot" style={{ background: swatch }} aria-hidden="true" />
                            {p.colorFamily}
                          </span>
                        )}
                        {p.size && <span>{p.size}</span>}
                        {p.rating && <Rating rating={p.rating} />}
                        {lastUnits && <span className="cup-last">{lastUnits}</span>}
                      </span>
                    </span>
                    <span className="cup-tone-prices">
                      <b>
                        {p.priceFrom && <span className="cup-from">Desde </span>}
                        {formatCop(p.price)}
                      </b>
                      {toneOff > 0 && <s>{formatCop(p.before)}</s>}
                    </span>
                  </PreviewLink>
                </li>
              );
            })}
          </ul>
          <p className="cup-note">
            Se compra en la tienda de {line.brand}, con el código <b className="cup-mono">{first.code}</b>.
          </p>
        </div>
      </dialog>
    </>
  );
}
