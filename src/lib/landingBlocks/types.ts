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

// A section heading ("Invitado especial") with an optional one-paragraph
// intro under it — what separates one part of the page from the next.
export interface HeadingLandingBlock {
  type: "heading";
  title: string;
  intro: string;
}

// The accent tints shared by the card and agenda blocks — a small fixed
// set (not a free color) so every event's page stays on-brand.
export type LandingTone = "teal" | "pink" | "peach";
export const LANDING_TONES: LandingTone[] = ["teal", "pink", "peach"];

export type LandingCardIcon = "none" | "gift" | "ticket" | "star" | "clock";
export const LANDING_CARD_ICONS: LandingCardIcon[] = ["none", "gift", "ticket", "star", "clock"];

// A highlighted card: small uppercase eyebrow ("LLEGA TEMPRANO"), a
// title, rich-text body, optional icon. Used for perks, raffles, a
// day-by-day program, anything that deserves its own box.
export interface CardLandingBlock {
  type: "card";
  eyebrow: string;
  title: string;
  // Same sanitized rich text as `text` blocks.
  html: string;
  icon: LandingCardIcon;
  tone: LandingTone;
}

// Rows of "chip + text": a day/time chip ("SÁB 7 · 2:00 p. m.") next to
// what happens then.
export interface AgendaLandingBlock {
  type: "agenda";
  rows: { chip: string; text: string; tone: LandingTone }[];
}

// "Dónde es": the venue as a card (name, address, hours all come from the
// event itself at render time — nothing retyped here) plus an optional
// photo and a Google Maps link.
export interface VenueLandingBlock {
  type: "venue";
  imageUrl: string;
  mapsUrl: string;
}

// A swipeable row of people cards ("Embajadoras de Cúcuta"): name,
// Instagram handle, a short tag ("Panel · Sáb 3:15"), optional photo —
// without one the card shows the person's initials in the chosen tone.
export interface PeopleLandingBlock {
  type: "people";
  items: { name: string; handle: string; tag: string; photoUrl: string; tone: LandingTone }[];
}

export type LandingBlock =
  | TextLandingBlock
  | ImageLandingBlock
  | GalleryLandingBlock
  | FaqLandingBlock
  | HeadingLandingBlock
  | CardLandingBlock
  | AgendaLandingBlock
  | VenueLandingBlock
  | PeopleLandingBlock;

function isFaqItem(v: unknown): v is { question: string; answer: string } {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).question === "string" && typeof (v as Record<string, unknown>).answer === "string";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function tone(v: unknown): LandingTone {
  return LANDING_TONES.includes(v as LandingTone) ? (v as LandingTone) : "teal";
}

function cardIcon(v: unknown): LandingCardIcon {
  return LANDING_CARD_ICONS.includes(v as LandingCardIcon) ? (v as LandingCardIcon) : "none";
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
      result.push({ type: "image", url: rec.url, caption: str(rec.caption) });
    } else if (rec.type === "gallery" && Array.isArray(rec.images) && rec.images.every((u) => typeof u === "string")) {
      result.push({ type: "gallery", images: rec.images as string[] });
    } else if (rec.type === "faq" && Array.isArray(rec.items)) {
      result.push({ type: "faq", title: str(rec.title), items: rec.items.filter(isFaqItem) });
    } else if (rec.type === "heading") {
      result.push({ type: "heading", title: str(rec.title), intro: str(rec.intro) });
    } else if (rec.type === "card") {
      result.push({ type: "card", eyebrow: str(rec.eyebrow), title: str(rec.title), html: str(rec.html), icon: cardIcon(rec.icon), tone: tone(rec.tone) });
    } else if (rec.type === "agenda" && Array.isArray(rec.rows)) {
      const rows = rec.rows
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({ chip: str(r.chip), text: str(r.text), tone: tone(r.tone) }));
      result.push({ type: "agenda", rows });
    } else if (rec.type === "venue") {
      result.push({ type: "venue", imageUrl: str(rec.imageUrl), mapsUrl: str(rec.mapsUrl) });
    } else if (rec.type === "people" && Array.isArray(rec.items)) {
      const items = rec.items
        .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .map((p) => ({ name: str(p.name), handle: str(p.handle), tag: str(p.tag), photoUrl: str(p.photoUrl), tone: tone(p.tone) }));
      result.push({ type: "people", items });
    }
  }
  return result;
}
