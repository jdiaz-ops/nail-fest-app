"use client";

import { useRef } from "react";
import { optimizedSrc } from "@/lib/optimizedImage";

// The 48px thumbnail next to a reviewer's name (ReviewCard.tsx). Tapping
// it opens every photo of that review in a native <dialog> lightbox —
// Esc, the ✕ or a tap outside closes it. Nothing loads until it opens.
export default function ReviewPhotoThumb({ photos, name }: { photos: string[]; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const first = photos[0];
  if (!first) return null;
  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();
  const label = photos.length === 1 ? `Ver la foto de ${name}` : `Ver las ${photos.length} fotos de ${name}`;

  return (
    <>
      <button type="button" className="review-card-thumb-btn" onClick={open} aria-label={label}>
        {/* eslint-disable-next-line @next/next/no-img-element -- attendee-uploaded Blob photo */}
        <img className="review-card-thumb" src={optimizedSrc(first, 128)} alt="" loading="lazy" decoding="async" />
        {photos.length > 1 && <span className="review-card-thumb-more">+{photos.length - 1}</span>}
      </button>
      <dialog
        ref={dialogRef}
        className="review-lightbox"
        aria-label={`Fotos de ${name}`}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="review-lightbox-body">
          <button type="button" className="review-lightbox-close" onClick={close} aria-label="Cerrar">
            ✕
          </button>
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- attendee-uploaded Blob photo
            <img key={url} src={optimizedSrc(url, 1080)} alt={`Foto ${i + 1} de ${name}`} loading="lazy" decoding="async" />
          ))}
          <div className="review-lightbox-caption">Foto de {name}</div>
        </div>
      </dialog>
    </>
  );
}
