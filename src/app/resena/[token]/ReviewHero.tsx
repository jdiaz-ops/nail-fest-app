import type { ReactNode } from "react";
import { optimizedSrc } from "@/lib/optimizedImage";

// The dark header of the attendee's review pages: the event's own landing
// image (Event.imageUrl), blurred and under a green scrim, with the logo,
// the page's eyebrow and whatever the page puts in it (seal + title +
// intro, or the thanks check). Without an image, the brand glows instead.
// Styles: globals.css (.rv-head*).
export default function ReviewHero({ brandName, eyebrow, imageUrl, children }: { brandName: string; eyebrow: string; imageUrl: string | null; children: ReactNode }) {
  return (
    <header className="rv-head">
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded event image, decorative */}
          <img className="rv-head-photo" src={optimizedSrc(imageUrl, 1200)} alt="" />
          <div className="rv-head-scrim" />
        </>
      ) : (
        <div className="rv-head-glow" />
      )}
      <div className="rv-head-inner">
        <div className="rv-bar">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img className="rv-logo" src="/logo.png" alt={brandName} />
          <span className="rv-eyebrow">{eyebrow}</span>
        </div>
        {children}
      </div>
    </header>
  );
}
