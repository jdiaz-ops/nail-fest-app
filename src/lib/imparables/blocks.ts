import type { CardLandingBlock, LandingBlock, PeopleLandingBlock } from "@/lib/landingBlocks/types";

// How Manicuristas Imparables' page reads an event's blocks
// (components/imparables/ImparablesBlocks.tsx): a card with no photo right
// before a people block is the panel, those people its panelists; the
// first other people block is the speakers, shown again as faces on the
// cover.

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
