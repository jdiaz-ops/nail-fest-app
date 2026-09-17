// Shape of Event.landingBlocks — see that column's own schema comment for
// why this exists as a third, self-service rendering path alongside
// `description` and `salesPageContent`. Built and reordered by
// LandingBlocksEditor.tsx (src/app/admin/events/), rendered by
// components/landingBlocks/LandingBlocksContent.tsx.
export interface TextLandingBlock {
  type: "text";
  // Same TipTap-produced, server-sanitized HTML as `description` (see
  // sanitizeEventDescription) — reuses RichTextEditor.tsx as-is.
  html: string;
}

export interface ImageLandingBlock {
  type: "image";
  url: string;
  caption: string;
}

export interface GalleryLandingBlock {
  type: "gallery";
  images: string[];
}

export interface FaqLandingBlock {
  type: "faq";
  // Optional heading above the accordion — blank means no heading, same
  // "empty = nothing extra rendered" convention as the other optional
  // text fields across the admin.
  title: string;
  items: { question: string; answer: string }[];
}

export type LandingBlock = TextLandingBlock | ImageLandingBlock | GalleryLandingBlock | FaqLandingBlock;

function isFaqItem(v: unknown): v is { question: string; answer: string } {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).question === "string" && typeof (v as Record<string, unknown>).answer === "string";
}

// Event.landingBlocks comes back from Prisma as `Prisma.JsonValue` — this
// is the one place that trusts it back into the real, ordered shape.
// Malformed/legacy entries are dropped, never thrown on — same "never let
// a bad DB value break a page render" posture as parseSalesPageContent
// and parseBrandLogos.
export function parseLandingBlocks(value: unknown): LandingBlock[] {
  if (!Array.isArray(value)) return [];
  const result: LandingBlock[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) continue;
    const rec = v as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.html === "string") {
      result.push({ type: "text", html: rec.html });
    } else if (rec.type === "image" && typeof rec.url === "string") {
      result.push({ type: "image", url: rec.url, caption: typeof rec.caption === "string" ? rec.caption : "" });
    } else if (rec.type === "gallery" && Array.isArray(rec.images) && rec.images.every((u) => typeof u === "string")) {
      result.push({ type: "gallery", images: rec.images as string[] });
    } else if (rec.type === "faq" && Array.isArray(rec.items)) {
      result.push({
        type: "faq",
        title: typeof rec.title === "string" ? rec.title : "",
        items: rec.items.filter(isFaqItem),
      });
    }
  }
  return result;
}
