import type { LandingBlock } from "@/lib/landingBlocks/types";

// Renders Event.landingBlocks in order — see that column's own schema
// comment. Sits in the exact same spot descriptionHtml/salesContent do
// today (EventRegistration.tsx), so it inherits the same column width;
// no full-bleed breakout for the image/gallery blocks.
export default function LandingBlocksContent({ blocks }: { blocks: LandingBlock[] }) {
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
                {block.title && <h2 className="sales-section-title">{block.title}</h2>}
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

          default:
            return null;
        }
      })}
    </div>
  );
}
