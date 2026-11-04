import { MESA_SECTIONS, type MesaPieceSection } from "./sections";

// La Mesa's blocks (the team, 2026-11-04): in each edition, its three
// sections, El Consultorio and Manicuristas Imparables' banner go in the
// order the team gives them — «Subir» and «Bajar» in the edition's card.
// The masthead, the hello and «En esta mesa» always open it; «Responde este
// correo», the doors and the legal line close it. Stored per edition
// (MesaEditionLayout); no row, the template's order and no banner. No
// database here: the admin's screen imports it too.

export const MESA_BLOCKS = ["JUEGO", "TERMOMETRO", "OFICIO", "CONSULTORIO", "IMPARABLES"] as const;
export type MesaBlock = (typeof MESA_BLOCKS)[number];

/** The template's order; the banner, once it's added, after the first section (the team's boceto). */
export const DEFAULT_MESA_BLOCKS: readonly MesaBlock[] = ["JUEGO", "IMPARABLES", "TERMOMETRO", "OFICIO", "CONSULTORIO"];

export function isMesaBlock(value: unknown): value is MesaBlock {
  return typeof value === "string" && (MESA_BLOCKS as readonly string[]).includes(value);
}

/** A stored order, made whole: each known block once, in its order; one it lacks, where the template has it. */
export function blockOrder(stored: unknown): MesaBlock[] {
  const order: MesaBlock[] = [];
  if (Array.isArray(stored)) for (const block of stored) if (isMesaBlock(block) && !order.includes(block)) order.push(block);
  DEFAULT_MESA_BLOCKS.forEach((block, i) => {
    if (order.includes(block)) return;
    const before = DEFAULT_MESA_BLOCKS.slice(0, i).reverse().find((b) => order.includes(b));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, block);
  });
  return order;
}

/** The block a section's piece is: the one to play with, El termómetro or the one for the trade. */
export function blockOf(section: MesaPieceSection): MesaBlock {
  if (section === "TERMOMETRO") return "TERMOMETRO";
  return MESA_SECTIONS[section].group === "juego" ? "JUEGO" : "OFICIO";
}

/** The blocks an edition shows, in its order: El Consultorio while it's public, the banner when it carries it. */
export function shownBlocks(order: readonly MesaBlock[], has: { consultorio: boolean; imparables: boolean }): MesaBlock[] {
  return order.filter((block) => (block === "CONSULTORIO" ? has.consultorio : block === "IMPARABLES" ? has.imparables : true));
}

/** The order with a block one place up or down among the ones the edition shows; the hidden ones keep their places. */
export function moveBlock(order: readonly MesaBlock[], block: MesaBlock, direction: "up" | "down", shown: readonly MesaBlock[]): MesaBlock[] {
  const next = [...order];
  const from = next.indexOf(block);
  if (from < 0 || !shown.includes(block)) return next;
  const step = direction === "up" ? -1 : 1;
  for (let to = from + step; to >= 0 && to < next.length; to += step) {
    if (shown.includes(next[to]!)) {
      [next[from], next[to]] = [next[to]!, next[from]!];
      break;
    }
  }
  return next;
}
