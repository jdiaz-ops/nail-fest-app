"use client";

import { useRef, useState } from "react";
import { showCuponeraNotice } from "./PreviewLink";
import type { CuponeraCoupon } from "@/lib/cuponera/sampleData";

// A brand coupon (RetailMeNot's "Ver código", Mercado Libre's terms):
// the card shows the offer, two conditions and the last characters of
// the code; the sheet shows the whole code, copies it, lists every
// condition and opens the store.
export default function CouponCard({ coupon, displayClassName }: { coupon: CuponeraCoupon; displayClassName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  const open = () => {
    setCopied(false);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
    } catch {
      // Clipboard blocked (permissions, old browser): the code stays on screen to copy by hand.
      setCopied(false);
    }
  };

  return (
    <article className="cup-coupon">
      <div className="cup-coupon-top">
        <span className={`cup-avatar cup-avatar--${coupon.tone}`} aria-hidden="true">
          {coupon.initial}
        </span>
        <div className="cup-coupon-text">
          <div className="cup-coupon-brandline">
            <span>{coupon.brand}</span>
            {coupon.exclusive && <span className="cup-exclusive">Exclusivo Nail Fest</span>}
          </div>
          <h3 className="cup-coupon-title">{coupon.title}</h3>
        </div>
      </div>
      <div className="cup-coupon-conds">
        {coupon.conditions.slice(0, 2).map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="cup-coupon-cut" />
      <div className="cup-coupon-foot">
        <span className="cup-verified">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007a74" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Verificado por Nail Fest
        </span>
        <button type="button" className="cup-reveal" onClick={open} aria-label={`Ver el código de ${coupon.brand}`}>
          <span className="cup-reveal-label">Ver código</span>
          <span className="cup-reveal-peek" aria-hidden="true">
            ··{coupon.code.slice(-2)}
          </span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="cup-sheet"
        aria-labelledby={`cup-sheet-${coupon.id}`}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="cup-sheet-body">
          <div className="cup-sheet-handle" aria-hidden="true" />
          <div className="cup-sheet-top">
            <div className="cup-coupon-top">
              <span className={`cup-avatar cup-avatar--${coupon.tone}`} aria-hidden="true">
                {coupon.initial}
              </span>
              <div className="cup-coupon-text">
                <span className="cup-sheet-brand">{coupon.brand}</span>
                {coupon.exclusive && <span className="cup-exclusive">Exclusivo Nail Fest</span>}
              </div>
            </div>
            <button type="button" className="cup-sheet-close" onClick={close} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <h2 id={`cup-sheet-${coupon.id}`} className={`cup-sheet-title ${displayClassName}`}>
            {coupon.title}
          </h2>
          <div className="cup-code">
            <span className="cup-code-text">{coupon.code}</span>
            <button type="button" className={copied ? "cup-copy is-done" : "cup-copy"} onClick={copy}>
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
          <p className="cup-sheet-note">Al tocar Ir a la tienda copiamos el código y abrimos la tienda. Si no aparece aplicado, pégalo al pagar.</p>
          <ul className="cup-conds">
            {coupon.conditions.map((c) => (
              <li key={c}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b5f6b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
          <a
            href={coupon.url ?? "#"}
            target={coupon.url ? "_blank" : undefined}
            rel={coupon.url ? "noopener" : undefined}
            className="cup-btn"
            onClick={(e) => {
              void copy();
              if (!coupon.url) {
                e.preventDefault();
                showCuponeraNotice(`Vista previa: aquí se abriría la tienda de ${coupon.brand} con el código ${coupon.code} ya copiado.`);
              }
            }}
          >
            Ir a la tienda de {coupon.brand}
          </a>
          <button
            type="button"
            className="cup-sheet-help"
            onClick={() => showCuponeraNotice("Vista previa: aquí la persona nos avisaría que el código no le funcionó.")}
          >
            ¿No te funcionó? Avísanos
          </button>
        </div>
      </dialog>
    </article>
  );
}
