"use client";

import Image from "next/image";

// Clarity showed real taps landing on the hero banner and on the
// description's own inline images, expecting SOMETHING to happen —
// people naturally treat a big event graphic as tappable. This is a
// client component (unlike the rest of [eventSlug]/page.tsx, a Server
// Component) only so it can dispatch this — EventRegistration.tsx (a
// separate client island lower on the page, which actually owns the
// modal's open/closed state) listens for it and opens the modal. A
// custom DOM event, not prop drilling, since the two components don't
// share a parent that could hold that state without turning the whole
// page client-side.
function openRegistration() {
  window.dispatchEvent(new Event("nailfest:open-registration"));
}

export default function ClickableHero({
  imageUrl,
  width,
  height,
  alt,
}: {
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <button
      type="button"
      onClick={openRegistration}
      aria-label={`Ver información de registro de ${alt}`}
      className="event-page-hero"
      style={{
        aspectRatio: `${width} / ${height}`,
        display: "block",
        width: "100%",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        background: "none",
      }}
    >
      <Image src={imageUrl} alt={alt} fill sizes="(min-width: 900px) 1080px, 100vw" priority style={{ objectFit: "cover" }} />
    </button>
  );
}
