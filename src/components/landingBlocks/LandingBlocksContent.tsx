import { Fraunces } from "next/font/google";
import ScrollCarousel from "@/components/ScrollCarousel";
import GalleryGrid from "./GalleryGrid";
import { instagramHandles, youtubeVideo, type AgendaRow, type LandingBlock, type LandingCardIcon } from "@/lib/landingBlocks/types";

// "Michell Rodríguez" -> "MR"; a single name gives one letter.
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

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

          case "video": {
            if (!block.url) return null;
            const yt = youtubeVideo(block.url);
            return (
              <figure key={i} className="landing-block-video">
                {yt ? (
                  <div className={`landing-video-embed${yt.vertical ? " is-vertical" : ""}`}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${yt.id}?rel=0&playsinline=1`}
                      title={block.caption || "Video"}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : block.autoplay ? (
                  <video src={block.url} autoPlay muted loop playsInline controls preload="auto" />
                ) : (
                  // "#t=0.1": without it, iPhones show a black box until play
                  // instead of the video's first frame.
                  <video src={`${block.url}#t=0.1`} controls playsInline preload="metadata" />
                )}
                {block.caption && <figcaption>{block.caption}</figcaption>}
              </figure>
            );
          }

          case "gallery":
            return block.items.length > 0 ? (
              <div key={i}>
                <GalleryGrid items={block.items} showFirst={block.showFirst} zoom={block.zoom} moreLabel={block.moreLabel} />
              </div>
            ) : null;

          case "faq": {
            const items = block.items.filter((item) => item.question.trim() || item.answer.trim());
            return items.length > 0 ? (
              <div key={i}>
                {block.title && <h2 className={`landing-section-title ${fraunces.className}`}>{block.title}</h2>}
                {items.map((item, j) => (
                  <details className="sales-faq-item" key={j}>
                    <summary>
                      {/* An answer with no question (the whole T&C pasted as
                          one item) still needs something to tap on. */}
                      {item.question.trim() || "Leer más"}
                      <span className="sales-faq-icon" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="sales-faq-answer">{item.answer}</p>
                  </details>
                ))}
              </div>
            ) : null;
          }

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
                {block.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                  <img src={block.imageUrl} alt={block.title} className="landing-card-image" />
                )}
                <div className="landing-card-main">
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
              </div>
            ) : null;

          case "points": {
            const items = block.items.filter((item) => item.title || item.text);
            return items.length > 0 ? (
              <div key={i} className={`landing-points landing-points--${block.tone}`}>
                {items.map((item, j) => (
                  <div key={j} className="landing-point">
                    {item.title && <h3 className="landing-point-title">{item.title}</h3>}
                    {item.text && <p className="landing-point-text">{item.text}</p>}
                  </div>
                ))}
              </div>
            ) : null;
          }

          case "agenda":
            return block.rows.length > 0 ? (
              <div key={i} className="landing-agenda">
                {block.rows.map((row, j) => (
                  <AgendaRowView key={j} row={row} />
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
                  {venue.hours.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
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

          case "people":
            return block.items.length > 0 ? (
              <div key={i} className="landing-people">
                <ScrollCarousel>
                  {block.items.map((person, j) => (
                    <div key={j} className="landing-person">
                      {person.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
                        <img src={person.photoUrl} alt="" className="landing-person-photo" />
                      ) : (
                        <span className={`landing-person-initials landing-person-initials--${person.tone}`} aria-hidden="true">
                          {initials(person.name)}
                        </span>
                      )}
                      <strong className="landing-person-name">{person.name}</strong>
                      {person.handle && (
                        <span className="landing-person-handle">{person.handle.startsWith("@") ? person.handle : `@${person.handle}`}</span>
                      )}
                      {person.tag && <span className={`landing-chip landing-chip--${person.tone}`}>{person.tag}</span>}
                    </div>
                  ))}
                </ScrollCarousel>
              </div>
            ) : null;

          default:
            return null;
        }
      })}
    </div>
  );
}

// "10:15 a. m." -> big "10:15" with a small "a. m." under it, like the
// Instagram cronograma; anything else ("SÁB 7 · 2:00") is shown as typed.
function AgendaTime({ chip }: { chip: string }) {
  const match = /^(\d{1,2}[:.]\d{2})\s*(.*)$/.exec(chip.trim());
  return (
    <span className="landing-agenda-time">
      {match ? (
        <>
          <span className={`landing-agenda-time-digits ${fraunces.className}`}>{match[1]}</span>
          {match[2] && <span className="landing-agenda-time-suffix">{match[2]}</span>}
        </>
      ) : (
        <span className="landing-agenda-time-text">{chip}</span>
      )}
    </span>
  );
}

function AgendaRowView({ row }: { row: AgendaRow }) {
  if (row.kind === "day") {
    return row.chip ? <h3 className={`landing-agenda-day landing-agenda-day--${row.tone} ${fraunces.className}`}>{row.chip}</h3> : null;
  }

  // Rows saved before topic/instructor existed keep everything in `text`.
  const title = row.topic || row.text;
  const note = row.topic ? row.text : "";
  const showSponsor = row.sponsored && (row.brand || row.brandLogoUrl);
  const who = [row.instructor, showSponsor ? "" : row.brand].filter(Boolean).join(" · ");
  const handles = instagramHandles(row.handles);
  if (!title && !who && !row.chip) return null;

  return (
    <div className={`landing-agenda-row landing-agenda-row--${row.tone}${showSponsor ? " is-sponsored" : ""}`}>
      {showSponsor && (
        <div className="landing-agenda-sponsor">
          <span>Presentado por</span>
          {/* The brand's name, not its logo: uploaded logos come in every
              size and background (a white box on the tinted row) and
              never line up with each other. A logo is only the fallback
              for a row that has no brand name typed. */}
          {row.brand ? (
            <strong className={`landing-agenda-sponsor-name ${fraunces.className}`}>{row.brand}</strong>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo, arbitrary Blob URL
            <img src={row.brandLogoUrl} alt="" className="landing-agenda-sponsor-logo" />
          )}
        </div>
      )}
      <div className="landing-agenda-main">
        {row.chip && <AgendaTime chip={row.chip} />}
        <div className="landing-agenda-info">
          {title && <strong className="landing-agenda-topic">{title}</strong>}
          {who && <span className="landing-agenda-who">{who}</span>}
          {handles.length > 0 && (
            <span className="landing-agenda-handles">
              {handles.map((h) => (
                <a key={h} href={`https://instagram.com/${encodeURIComponent(h)}`} target="_blank" rel="noopener noreferrer">
                  @{h}
                </a>
              ))}
            </span>
          )}
          {note && <span className="landing-agenda-note">{note}</span>}
        </div>
        {row.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo, arbitrary Blob URL
          <img src={row.photoUrl} alt={row.instructor} className="landing-agenda-photo" />
        )}
      </div>
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
