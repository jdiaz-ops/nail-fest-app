import ScrollCarousel from "./ScrollCarousel";

interface Props {
  imageUrls: string[];
}

// Event.galleryImageUrls, rendered just below the inline CTA and before
// the description (see EventRegistration.tsx). Same "pre-designed, we
// don't overlay anything" convention as the homepage's own gallery
// (page.tsx's homepage-gallery-grid) — captions are baked into the image
// itself, so tiles keep each photo's natural aspect ratio instead of
// cropping to a fixed size.
export default function EventGalleryCarousel({ imageUrls }: Props) {
  if (imageUrls.length === 0) return null;

  return (
    <ScrollCarousel>
      {imageUrls.map((url, i) => (
        <div className="event-gallery-carousel-item" key={url + i}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL */}
          <img src={url} alt="" />
        </div>
      ))}
    </ScrollCarousel>
  );
}
