import { Fraunces } from "next/font/google";
import type { LandingBlock, LandingCardIcon } from "@/lib/landingBlocks/types";

// Section headings in the brand's display face, same as the event hero.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

// What the "venue" block needs from the event itself — passed in by
// [eventSlug]/page.tsx so the block never stores a second copy of the
// venue name/address/hours that could go stale.
export interface LandingVenueContext {
  name: string;
  address: string;
  hours: string[];
}

// Renders Event.landingBlocks in order — see that column's own schema
// comment. Sits in the exact same spot descriptionHtml/salesContent do
// today (EventRegistration.tsx), so it inherits the same column width;
// no full-bleed breakout for the image/gallery blocks.
export default function LandingBlocksContent({ blocks, venue }: { blocks: LandingBlock[]; venue: LandingVenueContext }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            // Sanitized server-side before storage (lib/events.ts, same
            // sanitizeEventDescription as the plain `description` field)
            // — this is what renders it safely on an unauthenticated
            // public page. Reuses .event-description's own styling for
            // headings/lists/images so a text block looks identical to
            // the classic description editor's output.
            return block.html ? (
              <div key={i} className="event-description" dangerouslySetInnerHTML={{ __html: block.html }} />
            ) : null;

          case "image":
            return block.url ? (
              <figure key={i} className="landing-block-image">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded, arbitrary Blob URL, one per event */}
                <img src={block.url} alt={block.caption || ""} />
                {block.caption && <figcaption>{block.caption}</figcaption>}
              </figure>
            ) : null;

          case "gallery":
            return block.images.length > 0 ? (
              <div key={i} className="landing-block-gallery">
                {block.images.map((url, j) => (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL
                  <img key={j} src={url} alt="" className="landing-block-gallery-img" />
                ))}
              </div>
            ) : null;

          case "faq":
            return block.items.length > 0 ? (
              <div key={i}>
                {block.title && <h2 className={`landing-section-title ${fraunces.className}`}>{block.title}</h2>}
                {block.items.map((item, j) => (
                  <details className="sales-faq-item" key={j}>
                    <summary>
                      {item.question}
                      <span className="sales-faq-icon" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="sales-faq-answer">{item.answer}</p>
                  </details>
                ))}
              </div>
            ) : null;

          case "heading":
            return block.title || block.intro ? (
              <div key={i} className="landing-section">
                {block.title && <h2 className={`landing-section-title ${fraunces.className}`}>{block.title}</h2>}
                {block.intro && <p className="landing-section-intro">{block.intro}</p>}
              </div>
            ) : null;

          case "card":
            return block.title || block.html ? (
              <div key={i} className={`landing-card landing-card--${block.tone}`}>
                {block.icon !== "none" && (
                  <span className="landing-card-icon" aria-hidden="true">
                    <CardIcon icon={block.icon} />
                  </span>
                )}
                <div className="landing-card-text">
                  {block.eyebrow && <span className="landing-card-eyebrow">{block.eyebrow}</span>}
                  {block.title && <h3 className="landing-card-title">{block.title}</h3>}
                  {/* Sanitized server-side, same as text blocks — see lib/events.ts */}
                  {block.html && <div className="landing-card-body" dangerouslySetInnerHTML={{ __html: block.html }} />}
                </div>
              </div>
            ) : null;

          case "agenda":
            return block.rows.length > 0 ? (
              <div key={i} className="landing-agenda">
                {block.rows.map((row, j) => (
                  <div key={j} className="landing-agenda-row">
                    {row.chip && <span className={`landing-chip landing-chip--${row.tone}`}>{row.chip}</span>}
                    <span className="landing-agenda-text">{row.text}</span>
                  </div>
                ))}
              </div>
            ) : null;

          case "venue":
            return venue.name || venue.address ? (
              <div key={i} className="landing-venue">
                {block.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded venue photo, arbitrary Blob URL
                  <img src={block.imageUrl} alt="" className="landing-venue-image" />
                )}
                <div className="landing-venue-card">
                  {venue.name && <strong className="landing-venue-name">{venue.name}</strong>}
                  {venue.address && <span>{venue.address}</span>}
                  {venue.hours.length > 0 && <span>{venue.hours.join(" · ")}</span>}
                  {block.mapsUrl && (
                    <a href={block.mapsUrl} target="_blank" rel="noopener noreferrer" className="landing-venue-link">
                      Ver en Google Maps
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ) : null;

          default:
            return null;
        }
      })}
    </div>
  );
}

function CardIcon({ icon }: { icon: LandingCardIcon }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "gift":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13M5 12v9h14v-9M12 8a3 3 0 1 1 3-3c0 3-3 3-3 3zM12 8a3 3 0 1 0-3-3c0 3 3 3 3 3z" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
          <path d="M13 5v14" strokeDasharray="2 3" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    default:
      return null;
  }
}
