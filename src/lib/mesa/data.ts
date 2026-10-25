import Anthropic from "@anthropic-ai/sdk";
import type { MesaPiece, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bogotaDay } from "@/lib/library/data";
import { getLibrarySettings } from "@/lib/library/settings";
import { claudeKeyOf } from "@/lib/library/youtubeAutopilot";
import { MesaAiError, proposePieces, proposeSubjects, type MesaClient } from "./ai";
import {
  MESA_CONTENT,
  MESA_PIECE_SECTIONS,
  assignEditions,
  contentOf,
  editionDate,
  longDate,
  nextEdition,
  sectionsOf,
  shortDate,
  summaryOf,
  type AsuntoContent,
  type MesaPieceSection,
  type MesaSectionKey,
} from "./sections";

// La Mesa in the admin (2026-10-25): the bank of pieces — Claude's ideas
// waiting for the team, the approved ones in the order they go out — the
// next editions with what each still needs, and their subject lines.
// Nothing is sent from here.

const SETTINGS_ID = "singleton";
/** Thursday 5 November 2026, until the team picks another day. */
export const DEFAULT_FIRST_EDITION = new Date(Date.UTC(2026, 10, 5));
/** «Pedir ideas» brings this many. */
export const IDEAS_PER_ASK = 5;
/** Editions shown ahead, and the ones whose subject lines can be asked for. */
export const EDITIONS_AHEAD = 3;
/** Claude reads this many of a section's earlier pieces, not to repeat them. */
const AVOID_UP_TO = 150;
/** Ideas shown per section (the newest). */
const IDEAS_SHOWN = 40;

export async function getFirstEditionOn(): Promise<Date> {
  const row = await db.mesaSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row?.firstEditionOn ?? DEFAULT_FIRST_EDITION;
}

export async function setFirstEditionOn(day: Date): Promise<void> {
  await db.mesaSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, firstEditionOn: day }, update: { firstEditionOn: day } });
}

/** Claude's key: Vercel's, or the one pasted in the admin (the same the autopilot used). */
export async function mesaClient(): Promise<MesaClient> {
  const key = claudeKeyOf(await getLibrarySettings());
  if (!key) throw new MesaAiError("key");
  return new Anthropic({ apiKey: key.key, maxRetries: 1, timeout: 120_000 });
}

// ── What the admin shows ────────────────────────────────────────────────────

export interface MesaPieceView {
  id: string;
  section: MesaSectionKey;
  status: MesaPiece["status"];
  content: unknown;
  topic: string | null;
  /** An approved piece's edition, a subject line's edition; null when it has none yet. */
  edition: number | null;
  editionLabel: string | null;
}

export interface MesaEditionView {
  number: number;
  /** "jueves 5 de noviembre" */
  label: string;
  /** "5 nov" */
  short: string;
  /** Its three sections with pieces, in the email's order, and the piece each one has. */
  slots: { section: MesaPieceSection; pieceId: string | null; summary: string | null }[];
  complete: boolean;
  /** The chosen subject line; `outdated` when the edition's pieces changed after it was written. */
  subject: (MesaPieceView & { outdated: boolean }) | null;
  /** Claude's subject lines waiting for the team. */
  subjectIdeas: MesaPieceView[];
}

export interface MesaAdminData {
  /** "2026-11-05" */
  firstEditionOn: string;
  firstEditionLabel: string;
  editions: MesaEditionView[];
  ideas: Record<MesaPieceSection, MesaPieceView[]>;
  approved: Record<MesaPieceSection, MesaPieceView[]>;
  /** Claude's key is there (Vercel's or the admin's). */
  keyReady: boolean;
}

const bySection = <T>(make: () => T) => Object.fromEntries(MESA_PIECE_SECTIONS.map((s) => [s, make()])) as Record<MesaPieceSection, T>;

function editionLabel(first: Date, edition: number | null): string | null {
  return edition === null ? null : `Edición ${edition} · ${shortDate(editionDate(first, edition))}`;
}

function view(piece: MesaPiece, first: Date, edition: number | null = piece.edition): MesaPieceView {
  return { id: piece.id, section: piece.section, status: piece.status, content: piece.content, topic: piece.topic, edition, editionLabel: editionLabel(first, edition) };
}

/** The approved pieces still to go out, each section in its order. */
async function queues(): Promise<Record<MesaPieceSection, MesaPiece[]>> {
  const approved = await db.mesaPiece.findMany({
    where: { status: "APPROVED", edition: null, section: { not: "ASUNTO" } },
    orderBy: [{ position: "asc" }, { approvedAt: "asc" }],
  });
  const out = bySection<MesaPiece[]>(() => []);
  for (const piece of approved) out[piece.section as MesaPieceSection].push(piece);
  return out;
}

/** Edition n's pieces (section → piece), from the queues. */
function piecesOf(edition: number, assigned: Map<string, number>, all: Record<MesaPieceSection, MesaPiece[]>) {
  return sectionsOf(edition).map((section) => ({ section, piece: all[section].find((p) => assigned.get(p.id) === edition) ?? null }));
}

export async function getMesaAdminData(now: Date = new Date()): Promise<MesaAdminData> {
  const [first, all, ideaRows, subjectRows, librarySettings] = await Promise.all([
    getFirstEditionOn(),
    queues(),
    db.mesaPiece.findMany({ where: { status: "IDEA", section: { not: "ASUNTO" } }, orderBy: { createdAt: "desc" } }),
    db.mesaPiece.findMany({ where: { section: "ASUNTO", status: { in: ["IDEA", "APPROVED"] } }, orderBy: { createdAt: "desc" } }),
    getLibrarySettings(),
  ]);
  const next = nextEdition(first, bogotaDay(now));
  const assigned = assignEditions(all, next);

  const ideas = bySection<MesaPieceView[]>(() => []);
  for (const row of ideaRows) {
    const list = ideas[row.section as MesaPieceSection];
    if (list.length < IDEAS_SHOWN) list.push(view(row, first, null));
  }
  const approved = bySection<MesaPieceView[]>(() => []);
  for (const section of MESA_PIECE_SECTIONS) approved[section] = all[section].map((p) => view(p, first, assigned.get(p.id) ?? null));

  const editions: MesaEditionView[] = [];
  for (let number = next; number < next + EDITIONS_AHEAD; number++) {
    const pieces = piecesOf(number, assigned, all);
    const ids = pieces.map((p) => p.piece?.id ?? "");
    const chosen = subjectRows.find((s) => s.edition === number && s.status === "APPROVED");
    const chosenFor = chosen ? (contentOf("ASUNTO", chosen.content)?.pieceIds ?? []) : [];
    editions.push({
      number,
      label: longDate(editionDate(first, number)),
      short: shortDate(editionDate(first, number)),
      slots: pieces.map(({ section, piece }) => ({ section, pieceId: piece?.id ?? null, summary: piece ? summaryOf(section, piece.content) : null })),
      complete: pieces.every((p) => p.piece),
      subject: chosen ? { ...view(chosen, first), outdated: chosenFor.join("|") !== ids.join("|") } : null,
      // Only the ones written for the pieces it has now.
      subjectIdeas: subjectRows
        .filter((s) => s.edition === number && s.status === "IDEA" && (contentOf("ASUNTO", s.content)?.pieceIds ?? []).join("|") === ids.join("|"))
        .map((s) => view(s, first)),
    });
  }

  return {
    firstEditionOn: first.toISOString().slice(0, 10),
    firstEditionLabel: longDate(first),
    editions,
    ideas,
    approved,
    keyReady: claudeKeyOf(librarySettings) !== null,
  };
}

// ── What the team does ──────────────────────────────────────────────────────

export class MesaError extends Error {}

/** A section's earlier lines, for Claude not to propose them again: every
 * piece, approved, waiting or discarded. */
async function avoidFor(section: MesaSectionKey, edition?: number): Promise<string[]> {
  const rows = await db.mesaPiece.findMany({
    where: { section, ...(edition !== undefined ? { edition } : {}) },
    orderBy: { createdAt: "desc" },
    take: AVOID_UP_TO,
    select: { section: true, content: true },
  });
  return rows.map((r) => summaryOf(r.section, r.content)).filter(Boolean);
}

/** Claude's ideas for a section, saved as waiting for the team. */
export async function createIdeas(section: MesaPieceSection, topic: string | null, count = IDEAS_PER_ASK, client?: MesaClient): Promise<MesaPiece[]> {
  const proposed = await proposePieces(client ?? (await mesaClient()), section, { count, topic, avoid: await avoidFor(section) });
  return db.$transaction(proposed.map((content) => db.mesaPiece.create({ data: { section, content: content as Prisma.InputJsonValue, topic } })));
}

async function pieceOrThrow(id: string): Promise<MesaPiece> {
  const piece = await db.mesaPiece.findUnique({ where: { id } });
  if (!piece) throw new MesaError("Esa pieza ya no existe.");
  return piece;
}

/** Into the bank: last in its section's order. A subject line becomes its
 * edition's (the one chosen before goes back among the options). */
export async function approvePiece(id: string): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status === "DISCARDED") throw new MesaError("Esa idea ya se descartó.");
  if (piece.section === "ASUNTO") {
    await db.$transaction([
      db.mesaPiece.updateMany({ where: { section: "ASUNTO", edition: piece.edition, status: "APPROVED", id: { not: id } }, data: { status: "IDEA", approvedAt: null } }),
      db.mesaPiece.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } }),
    ]);
    return;
  }
  if (piece.status === "APPROVED") return;
  const last = await db.mesaPiece.aggregate({ where: { section: piece.section, status: "APPROVED" }, _max: { position: true } });
  await db.mesaPiece.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), position: (last._max.position ?? 0) + 1 } });
}

/** «Otra idea»: this one out for good, a new one in its place. */
export async function anotherIdea(id: string, client?: MesaClient): Promise<MesaPiece> {
  const piece = await pieceOrThrow(id);
  if (piece.status !== "IDEA") throw new MesaError("Solo se cambia una idea que todavía no está aprobada.");
  await db.mesaPiece.update({ where: { id }, data: { status: "DISCARDED" } });
  try {
    const [created] = piece.section === "ASUNTO" ? await createSubjects(piece.edition ?? 0, 1, client) : await createIdeas(piece.section, piece.topic, 1, client);
    if (!created) throw new MesaAiError("error", "La IA no trajo otra idea esta vez: vuelve a intentarlo.");
    return created;
  } catch (error) {
    // Nothing new: the old one comes back.
    await db.mesaPiece.update({ where: { id }, data: { status: "IDEA" } });
    throw error;
  }
}

/** «Editar»: the team's words over Claude's. */
export async function editPiece(id: string, content: unknown): Promise<void> {
  const piece = await pieceOrThrow(id);
  const merged = piece.section === "ASUNTO" ? { ...(content as object), pieceIds: contentOf("ASUNTO", piece.content)?.pieceIds ?? [] } : content;
  const parsed = MESA_CONTENT[piece.section].safeParse(merged);
  if (!parsed.success) throw new MesaError("Revisa los campos: alguno quedó vacío o muy largo.");
  await db.mesaPiece.update({ where: { id }, data: { content: parsed.data as Prisma.InputJsonValue } });
}

/** Out of the bank (it's never proposed again). */
export async function removePiece(id: string): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status !== "APPROVED") throw new MesaError("Esa pieza no está en el banco.");
  await db.mesaPiece.update({ where: { id }, data: { status: piece.section === "ASUNTO" ? "IDEA" : "DISCARDED", approvedAt: null } });
}

/** One place up or down in its section's order. */
export async function movePiece(id: string, direction: "up" | "down"): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status !== "APPROVED" || piece.section === "ASUNTO") throw new MesaError("Esa pieza no está en el banco.");
  const queue = (await queues())[piece.section as MesaPieceSection];
  const at = queue.findIndex((p) => p.id === id);
  const other = queue[direction === "up" ? at - 1 : at + 1];
  if (at < 0 || !other) return;
  // Positions as they show, so two with the same one still swap.
  await db.$transaction(
    queue.map((p, index) => {
      const position = p.id === id ? (direction === "up" ? index : index + 2) : p.id === other.id ? (direction === "up" ? index + 2 : index) : index + 1;
      return db.mesaPiece.update({ where: { id: p.id }, data: { position } });
    }),
  );
}

/** Claude's subject lines for an upcoming edition, written for the pieces it has now. */
export async function createSubjects(edition: number, count = IDEAS_PER_ASK, client?: MesaClient, now: Date = new Date()): Promise<MesaPiece[]> {
  const first = await getFirstEditionOn();
  const next = nextEdition(first, bogotaDay(now));
  if (edition < next || edition >= next + EDITIONS_AHEAD) throw new MesaError("Los asuntos se piden para las próximas ediciones.");
  const all = await queues();
  const pieces = piecesOf(edition, assignEditions(all, next), all);
  if (!pieces.every((p) => p.piece)) throw new MesaError("Primero aprueba las piezas de esta edición: el asunto sale de ellas.");
  const proposed = await proposeSubjects(
    client ?? (await mesaClient()),
    { edition, date: longDate(editionDate(first, edition)), pieces: pieces.map((p) => ({ section: p.section, content: p.piece!.content })) },
    { count, avoid: await avoidFor("ASUNTO") },
  );
  const pieceIds = pieces.map((p) => p.piece!.id);
  return db.$transaction(
    proposed.options.map((option) =>
      db.mesaPiece.create({ data: { section: "ASUNTO", edition, content: { ...option, intro: proposed.intro, pieceIds } satisfies AsuntoContent } }),
    ),
  );
}
