"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { instagramHandles, type GalleryItem } from "@/lib/landingBlocks/types";

// The "Galería" landing block: a grid (2 columns on a phone, 3–4 wider),
// optionally only the first few with a "Ver todas" button, and — when
// `zoom` is on — tapping a photo opens it full-screen with a counter,
// arrows, swipe left/right between photos, swipe down or ✕ to close, and
// a "Ver su Instagram" button for a photo that has an account set.
export default function GalleryGrid({
  items,
  showFirst,
  zoom,
  moreLabel,
}: {
  items: GalleryItem[];
  showFirst: number;
  zoom: boolean;
  moreLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const visible = showFirst > 0 && !expanded ? items.slice(0, showFirst) : items;
  const hiddenCount = items.length - visible.length;

  return (
    <>
      <div className="landing-block-gallery">
        {visible.map((item, i) =>
          zoom ? (
            <button key={item.url + i} type="button" className="landing-gallery-tile" onClick={() => setOpen(i)} aria-label={`Ver foto ${i + 1} en grande`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL */}
              <img src={item.url} alt="" loading="lazy" className="landing-block-gallery-img" />
            </button>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL
            <img key={item.url + i} src={item.url} alt="" loading="lazy" className="landing-block-gallery-img" />
          )
        )}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="landing-gallery-more" onClick={() => setExpanded(true)}>
          {moreLabel.trim() || `Ver todas (${items.length})`} ↓
        </button>
      )}
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = items[index]!;
  const handle = instagramHandles(item.handle)[0];
  const go = useCallback((dir: -1 | 1) => onIndex((index + dir + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  // Neighbours load in the background so a swipe shows the next photo at once.
  const prevUrl = items[(index - 1 + items.length) % items.length]!.url;
  const nextUrl = items[(index + 1) % items.length]!.url;

  return (
    <div
      className="landing-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} de ${items.length}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <div className="landing-lightbox-top">
        <span>
          {index + 1} / {items.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="landing-lightbox-close">
          ✕
        </button>
      </div>
      {items.length > 1 && (
        <>
          <button type="button" className="landing-lightbox-arrow is-prev" onClick={() => go(-1)} aria-label="Foto anterior">
            ‹
          </button>
          <button type="button" className="landing-lightbox-arrow is-next" onClick={() => go(1)} aria-label="Foto siguiente">
            ›
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL */}
      <img src={item.url} alt="" className="landing-lightbox-img" />
      {handle && (
        <a href={`https://instagram.com/${encodeURIComponent(handle)}`} target="_blank" rel="noopener noreferrer" className="landing-lightbox-ig">
          Ver su Instagram · @{handle}
        </a>
      )}
      {items.length > 1 && <p className="landing-lightbox-hint">Desliza para ver la siguiente</p>}
      <link rel="preload" as="image" href={prevUrl} />
      <link rel="preload" as="image" href={nextUrl} />
    </div>
  );
}
