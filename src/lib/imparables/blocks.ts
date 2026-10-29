import type { AgendaRow, CardLandingBlock, HeadingLandingBlock, ImageLandingBlock, LandingBlock, PeopleLandingBlock, TextLandingBlock } from "@/lib/landingBlocks/types";

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

/** The (first) panel: its card and its panelists. */
export function panelOf(blocks: LandingBlock[]): { card: CardLandingBlock; people: PeopleLandingBlock } | null {
  const i = blocks.findIndex((b, j) => isPanelCard(b, blocks[j + 1]));
  return i === -1 ? null : { card: blocks[i] as CardLandingBlock, people: blocks[i + 1] as PeopleLandingBlock };
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

/** The cover's sequel (2026-10-29): when the page opens with a section that is
 * only a title without an eyebrow and a text — «¿Qué tienen en común todos los
 * conferencistas?» — it is told right under the cover, in the cover's colors,
 * and the sections after it keep taking turns as before. */
export function introOf(blocks: LandingBlock[]): { intro: { heading: HeadingLandingBlock; text: TextLandingBlock } | null; rest: LandingBlock[] } {
  const [heading, text, next] = blocks;
  const isIntro =
    heading?.type === "heading" && !heading.eyebrow.trim() && Boolean(heading.title.trim()) && text?.type === "text" && Boolean(text.html.trim()) && (!next || next.type === "heading");
  if (!isIntro) return { intro: null, rest: blocks };
  return { intro: { heading: heading as HeadingLandingBlock, text: text as TextLandingBlock }, rest: blocks.slice(2) };
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

/** The panel's guests, those with a name or the story they bring: the ones already confirmed (named) first. */
export function panelGuestsOf(people: PeopleLandingBlock): PeopleLandingBlock["items"] {
  const guests = people.items.filter((p) => p.name.trim() || p.tag.trim());
  return [...guests.filter((p) => p.name.trim()), ...guests.filter((p) => !p.name.trim())];
}

/** A day's route, from its talks' steps («Paso 1 · Tus números», «Paso 2 · Tu esencia»…):
 * ["Tus números", "tu esencia"], to read with arrows between. Fewer than two steps make no route. */
export function routeOf(rows: AgendaRow[]): string[] {
  const steps = rows
    .map((row) => /^paso\s*\d+\s*[·:.\-–—]\s*(.+)$/i.exec(row.label.trim())?.[1]?.trim())
    .filter((step): step is string => Boolean(step));
  if (steps.length < 2) return [];
  return steps.map((step, i) => (i === 0 ? step : step.charAt(0).toLowerCase() + step.slice(1)));
}

/** Who is under the group photo: the speakers' names, then the host and the panel. */
export function castLine(blocks: LandingBlock[]): { names: string; also: string } {
  const host = blocks.find((b): b is CardLandingBlock => b.type === "card" && Boolean(b.imageUrl) && Boolean(b.title.trim()));
  const panel = blocks.find((b, i): b is CardLandingBlock => isPanelCard(b, blocks[i + 1]) && Boolean(b.title.trim()));
  const also = [host ? `con ${host.title.trim()}` : "", panel ? `${host ? "y " : "con "}el panel «${panel.title.trim()}»` : ""].filter(Boolean).join(" ");
  return { names: listNames(castOf(blocks).speakers.map((s) => s.name.trim())), also };
}
