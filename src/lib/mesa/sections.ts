import { z } from "zod";

// La Mesa (2026-10-25): Nail Fest's newsletter, every 15 days on Thursday.
// Five blocks in every edition, always in this order: one section to play
// with (Mito o verdad, La palabra or ¿Sabías que…?, in turns), El
// termómetro, one for the trade (El truco or ¿Por qué pasó?, in turns), La
// galería and El Consultorio. Claude proposes the pieces of the ones that
// take turns, El termómetro's questions and each edition's subject line
// (./ai.ts); the team approves them or asks for another. No database here:
// the admin's screen imports it too.

export type MesaPieceSection = "MITO" | "PALABRA" | "SABIAS" | "TRUCO" | "PORQUE" | "TERMOMETRO";
export type MesaSectionKey = MesaPieceSection | "ASUNTO";

/** The sections with pieces in the bank, in the admin's order, each with its nail-polish color (the same as in the email). */
export const MESA_SECTIONS: Record<MesaPieceSection, { name: string; color: string; group: "juego" | "oficio" | "fija" }> = {
  MITO: { name: "Mito o verdad", color: "#ff6b57", group: "juego" },
  PALABRA: { name: "La palabra", color: "#0f7d76", group: "juego" },
  SABIAS: { name: "¿Sabías que…?", color: "#7b61d1", group: "juego" },
  TRUCO: { name: "El truco", color: "#3b6fd8", group: "oficio" },
  PORQUE: { name: "¿Por qué pasó?", color: "#26336e", group: "oficio" },
  TERMOMETRO: { name: "El termómetro", color: "#e3a008", group: "fija" },
};

export const MESA_PIECE_SECTIONS = Object.keys(MESA_SECTIONS) as MesaPieceSection[];

/** The two that come from the community, in every edition. */
export const MESA_COMMUNITY = {
  galeria: { name: "La galería", color: "#e8457a" },
  consultorio: { name: "El Consultorio", color: "#e9845f" },
} as const;

export function isPieceSection(value: string): value is MesaPieceSection {
  return value in MESA_SECTIONS;
}

// ── Each section's piece ────────────────────────────────────────────────────

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const MESA_CONTENT = {
  MITO: z.object({ statement: text(8, 180), answer: z.enum(["mito", "verdad"]), explanation: text(20, 420) }),
  PALABRA: z.object({ word: text(1, 60), kind: text(1, 40), definition: text(20, 420), example: text(10, 260) }),
  SABIAS: z.object({ fact: text(15, 260), detail: text(10, 420) }),
  TRUCO: z.object({ title: text(8, 140), trick: text(20, 420) }),
  PORQUE: z.object({ question: text(8, 160), causes: z.array(text(3, 180)).min(2).max(4), steps: z.array(text(3, 220)).length(3) }),
  TERMOMETRO: z.object({ question: text(8, 160), options: z.array(text(1, 40)).min(2).max(4) }),
  ASUNTO: z.object({
    subject: text(5, 110),
    preheader: text(10, 160),
    intro: text(20, 420),
    tags: z.array(text(1, 30)).max(3),
    /** The pieces it was written for: a different set later means it's out of date. */
    pieceIds: z.array(z.string()),
  }),
} satisfies Record<MesaSectionKey, z.ZodTypeAny>;

export type MesaContent<S extends MesaSectionKey> = z.infer<(typeof MESA_CONTENT)[S]>;
export type MitoContent = MesaContent<"MITO">;
export type PalabraContent = MesaContent<"PALABRA">;
export type SabiasContent = MesaContent<"SABIAS">;
export type TrucoContent = MesaContent<"TRUCO">;
export type PorqueContent = MesaContent<"PORQUE">;
export type TermometroContent = MesaContent<"TERMOMETRO">;
export type AsuntoContent = MesaContent<"ASUNTO">;

/** A stored piece's content, checked; null when it doesn't fit its section. */
export function contentOf<S extends MesaSectionKey>(section: S, value: unknown): MesaContent<S> | null {
  const parsed = MESA_CONTENT[section].safeParse(value);
  return parsed.success ? (parsed.data as MesaContent<S>) : null;
}

/** The line that names a piece: in the bank's list, and for Claude not to propose it again. */
export function summaryOf(section: MesaSectionKey, content: unknown): string {
  const c = (content ?? {}) as Record<string, unknown>;
  const field = { MITO: "statement", PALABRA: "word", SABIAS: "fact", TRUCO: "title", PORQUE: "question", TERMOMETRO: "question", ASUNTO: "subject" }[section];
  const value = c[field];
  return typeof value === "string" ? value : "";
}

/** «{nombre}» in a subject line: each person's first name when it goes out. */
export const NAME_TOKEN = "{nombre}";

// ── The editions ────────────────────────────────────────────────────────────

export const MESA_EVERY_DAYS = 14;
const DAY_MS = 86_400_000;

/** The ones that take turns: one to play with and one for the trade in each edition. */
export const MESA_JUEGO: MesaPieceSection[] = ["MITO", "PALABRA", "SABIAS"];
export const MESA_OFICIO: MesaPieceSection[] = ["TRUCO", "PORQUE"];

/** Edition n's sections with pieces, in the email's order: the one to play
 * with (it opens the email and gives the subject), El termómetro, the one
 * for the trade. La galería and El Consultorio follow. */
export function sectionsOf(edition: number): MesaPieceSection[] {
  const turn = (list: MesaPieceSection[]) => list[(((edition - 1) % list.length) + list.length) % list.length]!;
  return [turn(MESA_JUEGO), "TERMOMETRO", turn(MESA_OFICIO)];
}

/** Edition n's day (UTC midnight, like the stored date). */
export function editionDate(firstEditionOn: Date, edition: number): Date {
  return new Date(firstEditionOn.getTime() + (edition - 1) * MESA_EVERY_DAYS * DAY_MS);
}

/** The first edition on or after `today` (both UTC midnights). */
export function nextEdition(firstEditionOn: Date, today: Date): number {
  const days = Math.ceil((today.getTime() - firstEditionOn.getTime()) / DAY_MS);
  return days <= 0 ? 1 : Math.ceil(days / MESA_EVERY_DAYS) + 1;
}

/** Which edition each approved piece goes out in: those of a section take,
 * in their order, the next editions that use it — from `from` on, up to
 * `horizon` editions ahead. A piece further back has none yet. */
export function assignEditions(queues: Partial<Record<MesaPieceSection, { id: string }[]>>, from: number, horizon = 36): Map<string, number> {
  const assigned = new Map<string, number>();
  for (const section of MESA_PIECE_SECTIONS) {
    const queue = queues[section] ?? [];
    let next = 0;
    for (let edition = from; edition < from + horizon && next < queue.length; edition++) {
      if (sectionsOf(edition).includes(section)) assigned.set(queue[next++]!.id, edition);
    }
  }
  return assigned;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "jueves 5 de noviembre" */
export function longDate(day: Date): string {
  return `${WEEKDAYS[day.getUTCDay()]!} ${day.getUTCDate()} de ${MONTHS[day.getUTCMonth()]!}`;
}

/** "5 nov" */
export function shortDate(day: Date): string {
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]!.slice(0, 3)}`;
}
