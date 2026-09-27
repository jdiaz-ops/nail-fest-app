"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  imageUrls: string[];
}

// Event.galleryImageUrls, rendered just below the inline CTA and before
// the description (see EventRegistration.tsx). Same "pre-designed, we
// don't overlay anything" convention as the homepage's own gallery
// (page.tsx's homepage-gallery-grid) — captions are baked into the image
// itself, so tiles keep each photo's natural aspect ratio instead of
// cropping to a fixed size. The one difference from that static grid is
// that this one scrolls horizontally, per the approved mock.
export default function EventGalleryCarousel({ imageUrls }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!track) return;
        const items = Array.from(track.children) as HTMLElement[];
        const center = track.scrollLeft + track.clientWidth / 2;
        let closest = 0;
        let closestDist = Infinity;
        items.forEach((item, i) => {
          const dist = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });
        setActiveIndex(closest);
      });
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (imageUrls.length === 0) return null;

  return (
    <div className="event-gallery-carousel">
      <div className="event-gallery-carousel-track" ref={trackRef}>
        {imageUrls.map((url, i) => (
          <div className="event-gallery-carousel-item" key={url + i}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL */}
            <img src={url} alt="" />
          </div>
        ))}
      </div>
      {imageUrls.length > 1 && (
        <div className="event-gallery-carousel-dots">
          {imageUrls.map((url, i) => (
            <span key={url + i} className={`event-gallery-carousel-dot${i === activeIndex ? " is-active" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
