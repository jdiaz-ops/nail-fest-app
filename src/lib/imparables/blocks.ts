import type { CardLandingBlock, ImageLandingBlock, LandingBlock, PeopleLandingBlock } from "@/lib/landingBlocks/types";

// How Manicuristas Imparables' page reads an event's blocks
// (components/imparables/ImparablesBlocks.tsx): an image before the first
// section title is the cover's group photo; a card with no photo right
// before a people block is the panel, those people its panelists; the
// first other people block is the speakers, named under the group photo
// (or shown as faces on the cover when there's none); a card with a photo
// is the host.

export function isPanelCard(block: LandingBlock | undefined, next: LandingBlock | undefined): block is CardLandingBlock {
  return block?.type === "card" && !block.imageUrl && next?.type === "people";
}

/** The speakers (the first people not drawn as the panel) and how many panels there are. */
export function castOf(blocks: LandingBlock[]): { speakers: PeopleLandingBlock["items"]; panels: number } {
  let speakers: PeopleLandingBlock["items"] | null = null;
  let panels = 0;
  blocks.forEach((block, i) => {
    if (block.type !== "people") return;
    if (isPanelCard(blocks[i - 1], block)) panels += 1;
    else if (!speakers) speakers = block.items.filter((p) => p.name.trim());
  });
  return { speakers: speakers ?? [], panels };
}

/** The cover's group photo — an image before the first section title — and the blocks without it. */
export function coverOf(blocks: LandingBlock[]): { cover: ImageLandingBlock | null; rest: LandingBlock[] } {
  const firstHeading = blocks.findIndex((b) => b.type === "heading");
  const i = blocks.findIndex((b, j) => b.type === "image" && Boolean(b.url) && (firstHeading === -1 || j < firstHeading));
  if (i === -1) return { cover: null, rest: blocks };
  return { cover: blocks[i] as ImageLandingBlock, rest: blocks.filter((_, j) => j !== i) };
}

/** ["Jimena", "Pau", "Oskar"] -> "Jimena, Pau y Oskar" */
export function listNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] ?? "");
}

/** "Fabi, Alejandro Salinas y Oskar" -> ["Fabi", "Alejandro Salinas", "Oskar"] */
export function namesIn(who: string): string[] {
  return who
    .split(/\s*,\s*|\s+y\s+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Who is under the group photo: the speakers' names, then the host and the panel. */
export function castLine(blocks: LandingBlock[]): { names: string; also: string } {
  const host = blocks.find((b): b is CardLandingBlock => b.type === "card" && Boolean(b.imageUrl) && Boolean(b.title.trim()));
  const panel = blocks.find((b, i): b is CardLandingBlock => isPanelCard(b, blocks[i + 1]) && Boolean(b.title.trim()));
  const also = [host ? `con ${host.title.trim()}` : "", panel ? `${host ? "y " : "con "}el panel «${panel.title.trim()}»` : ""].filter(Boolean).join(" ");
  return { names: listNames(castOf(blocks).speakers.map((s) => s.name.trim())), also };
}
