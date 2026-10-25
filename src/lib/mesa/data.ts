import Anthropic from "@anthropic-ai/sdk";
import type { MesaPiece, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBroadcastEmailStats, statsFor } from "@/lib/email/broadcastStats";
import { bogotaDay } from "@/lib/library/data";
import { getLibrarySettings } from "@/lib/library/settings";
import { claudeKeyOf } from "@/lib/library/youtubeAutopilot";
import { MesaAiError, proposePieces, proposeSubjects, type MesaClient } from "./ai";
import { percentages, type MesaEditionSnapshot } from "./email";
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
import { cityTally, tally } from "./votes";

// La Mesa in the admin (2026-10-25): the bank of pieces — Claude's ideas
// waiting for the team, the approved ones in the order they go out — the
// next editions with what each still needs, their subject lines, and their
// sends. Scheduling an edition (lib/mesa/sends.ts) pins its pieces to it:
// they leave the queue, the rotation skips that edition, and they come back
// if the send is cancelled. What a sent edition's answers add up to, too.

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
/** Sent editions whose answers the admin shows. */
const SENT_SHOWN = 6;

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

export class MesaError extends Error {}

// ── The sends that hold an edition ──────────────────────────────────────────

/** An edition's send: scheduled, going out or sent (a cancelled one lets the edition go). */
export interface MesaSendView {
  id: string;
  edition: number;
  status: "QUEUED" | "SENDING" | "SENT";
  /** ISO */
  scheduledAt: string | null;
  sentAt: string | null;
  segmentId: string | null;
  segmentName: string | null;
}

export async function mesaSends(): Promise<Map<number, MesaSendView>> {
  const rows = await db.emailBroadcast.findMany({
    where: { mesaEdition: { not: null }, status: { in: ["QUEUED", "SENDING", "SENT"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, mesaEdition: true, status: true, scheduledAt: true, sentAt: true, segmentId: true, segment: { select: { name: true } } },
  });
  const out = new Map<number, MesaSendView>();
  for (const row of rows) {
    out.set(row.mesaEdition!, {
      id: row.id,
      edition: row.mesaEdition!,
      status: row.status as MesaSendView["status"],
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      segmentId: row.segmentId,
      segmentName: row.segment?.name ?? null,
    });
  }
  return out;
}

/** The edition's send, when it has one. */
export async function sendOf(edition: number): Promise<MesaSendView | null> {
  return (await mesaSends()).get(edition) ?? null;
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
  /** In a scheduled edition: it only changes with «Editar». */
  pinned: boolean;
}

export interface MesaEditionView {
  number: number;
  /** "2026-11-05" */
  day: string;
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
  /** Scheduled, going out or sent. */
  send: MesaSendView | null;
}

/** A sent edition: how it went and what they answered. */
export interface MesaSentView {
  edition: number;
  label: string;
  broadcastId: string;
  subject: string;
  status: "SENDING" | "SENT";
  sent: number;
  opened: number;
  /** Over the delivered ones. */
  openRate: number | null;
  mito: { statement: string; answer: "mito" | "verdad"; total: number; rightPct: number | null } | null;
  termometro: { question: string; options: string[]; votes: number[]; pcts: number[]; total: number; cities: { label: string; total: number; top: string; pct: number }[] } | null;
}

export interface MesaAdminData {
  /** "2026-11-05" */
  firstEditionOn: string;
  firstEditionLabel: string;
  editions: MesaEditionView[];
  ideas: Record<MesaPieceSection, MesaPieceView[]>;
  approved: Record<MesaPieceSection, MesaPieceView[]>;
  sent: MesaSentView[];
  /** Claude's key is there (Vercel's or the admin's). */
  keyReady: boolean;
}

const bySection = <T>(make: () => T) => Object.fromEntries(MESA_PIECE_SECTIONS.map((s) => [s, make()])) as Record<MesaPieceSection, T>;

function editionLabel(first: Date, edition: number | null, scheduled = false): string | null {
  return edition === null ? null : `Edición ${edition} · ${shortDate(editionDate(first, edition))}${scheduled ? " · programada" : ""}`;
}

function view(piece: MesaPiece, first: Date, edition: number | null = piece.edition, pinned = false): MesaPieceView {
  return {
    id: piece.id,
    section: piece.section,
    status: piece.status,
    content: piece.content,
    topic: piece.topic,
    edition,
    editionLabel: editionLabel(first, edition, pinned),
    pinned,
  };
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

/** The pieces pinned to these editions (their sends hold them). */
async function pinnedPieces(editions: number[]): Promise<MesaPiece[]> {
  if (editions.length === 0) return [];
  return db.mesaPiece.findMany({ where: { edition: { in: editions }, status: "APPROVED", section: { not: "ASUNTO" } } });
}

type Slot = { section: MesaPieceSection; piece: MesaPiece | null };

/** Edition n's pieces in the email's order: the ones pinned to it once it's
 * scheduled; before that, the ones the queues give it. */
function slotsOf(edition: number, ctx: { held: boolean; pinned: MesaPiece[]; assigned: Map<string, number>; all: Record<MesaPieceSection, MesaPiece[]> }): Slot[] {
  return sectionsOf(edition).map((section) => ({
    section,
    piece: ctx.held
      ? (ctx.pinned.find((p) => p.edition === edition && p.section === section) ?? null)
      : (ctx.all[section].find((p) => ctx.assigned.get(p.id) === edition) ?? null),
  }));
}

/** What the edition has now, for the email and its subject lines. */
export async function editionPieces(edition: number, now: Date = new Date()): Promise<Slot[]> {
  const [first, sends] = await Promise.all([getFirstEditionOn(), mesaSends()]);
  const held = sends.has(edition);
  const [all, pinned] = await Promise.all([queues(), pinnedPieces(held ? [edition] : [])]);
  const assigned = assignEditions(all, nextEdition(first, bogotaDay(now)), undefined, new Set(sends.keys()));
  return slotsOf(edition, { held, pinned, assigned, all });
}

export async function getMesaAdminData(now: Date = new Date()): Promise<MesaAdminData> {
  const [first, all, sends, ideaRows, subjectRows, librarySettings] = await Promise.all([
    getFirstEditionOn(),
    queues(),
    mesaSends(),
    db.mesaPiece.findMany({ where: { status: "IDEA", section: { not: "ASUNTO" } }, orderBy: { createdAt: "desc" } }),
    db.mesaPiece.findMany({ where: { section: "ASUNTO", status: { in: ["IDEA", "APPROVED"] } }, orderBy: { createdAt: "desc" } }),
    getLibrarySettings(),
  ]);
  const next = nextEdition(first, bogotaDay(now));
  const held = new Set(sends.keys());
  const assigned = assignEditions(all, next, undefined, held);
  const pinned = await pinnedPieces([...held].filter((n) => sends.get(n)!.status !== "SENT" || n >= next));

  const ideas = bySection<MesaPieceView[]>(() => []);
  for (const row of ideaRows) {
    const list = ideas[row.section as MesaPieceSection];
    if (list.length < IDEAS_SHOWN) list.push(view(row, first, null));
  }
  // In the bank: first the ones a scheduled edition holds (only «Editar»), then the queue.
  const approved = bySection<MesaPieceView[]>(() => []);
  for (const section of MESA_PIECE_SECTIONS) {
    const scheduled = pinned.filter((p) => p.section === section && sends.get(p.edition!)?.status === "QUEUED").sort((a, b) => a.edition! - b.edition!);
    approved[section] = [...scheduled.map((p) => view(p, first, p.edition, true)), ...all[section].map((p) => view(p, first, assigned.get(p.id) ?? null))];
  }

  // The next editions — and one whose send is still waiting or going out, even if its day passed.
  const waiting = [...sends.values()].filter((s) => s.status !== "SENT").map((s) => s.edition);
  const start = Math.min(next, ...waiting);
  const editions: MesaEditionView[] = [];
  for (let number = start; number < next + EDITIONS_AHEAD; number++) {
    const send = sends.get(number) ?? null;
    if (number < next && !send) continue;
    const slots = slotsOf(number, { held: held.has(number), pinned, assigned, all });
    const ids = slots.map((s) => s.piece?.id ?? "");
    const chosen = subjectRows.find((s) => s.edition === number && s.status === "APPROVED");
    const chosenFor = chosen ? (contentOf("ASUNTO", chosen.content)?.pieceIds ?? []) : [];
    editions.push({
      number,
      day: editionDate(first, number).toISOString().slice(0, 10),
      label: longDate(editionDate(first, number)),
      short: shortDate(editionDate(first, number)),
      slots: slots.map(({ section, piece }) => ({ section, pieceId: piece?.id ?? null, summary: piece ? summaryOf(section, piece.content) : null })),
      complete: slots.every((s) => s.piece),
      subject: chosen ? { ...view(chosen, first), outdated: chosenFor.join("|") !== ids.join("|") } : null,
      // Only the ones written for the pieces it has now.
      subjectIdeas: subjectRows
        .filter((s) => s.edition === number && s.status === "IDEA" && (contentOf("ASUNTO", s.content)?.pieceIds ?? []).join("|") === ids.join("|"))
        .map((s) => view(s, first)),
      send,
    });
  }

  return {
    firstEditionOn: first.toISOString().slice(0, 10),
    firstEditionLabel: longDate(first),
    editions,
    ideas,
    approved,
    sent: await sentEditions(first),
    keyReady: claudeKeyOf(librarySettings) !== null,
  };
}

/** The editions that went out (or are going out), the newest first: opens and answers. */
async function sentEditions(first: Date): Promise<MesaSentView[]> {
  const rows = await db.emailBroadcast.findMany({
    where: { mesaEdition: { not: null }, status: { in: ["SENDING", "SENT"] } },
    orderBy: { mesaEdition: "desc" },
    take: SENT_SHOWN,
    select: { id: true, mesaEdition: true, status: true, subject: true, mesaContent: true },
  });
  if (rows.length === 0) return [];
  const stats = await getBroadcastEmailStats(rows.map((r) => r.id));
  return Promise.all(
    rows.map(async (row): Promise<MesaSentView> => {
      const snapshot = row.mesaContent as unknown as MesaEditionSnapshot | null;
      const s = statsFor(stats, row.id);
      const mitoPiece = snapshot?.pieces.find((p) => p.section === "MITO");
      const mito = mitoPiece ? contentOf("MITO", mitoPiece.content) : null;
      const termoPiece = snapshot?.pieces.find((p) => p.section === "TERMOMETRO");
      const termo = termoPiece ? contentOf("TERMOMETRO", termoPiece.content) : null;

      let mitoView: MesaSentView["mito"] = null;
      if (mitoPiece && mito) {
        const votes = await tally(mitoPiece.id, 2);
        const total = votes[0]! + votes[1]!;
        const right = votes[mito.answer === "mito" ? 0 : 1]!;
        mitoView = { statement: mito.statement, answer: mito.answer, total, rightPct: total > 0 ? Math.round((right / total) * 100) : null };
      }
      let termoView: MesaSentView["termometro"] = null;
      if (termoPiece && termo) {
        const [votes, cities] = await Promise.all([tally(termoPiece.id, termo.options.length), cityTally(termoPiece.id, termo.options.length)]);
        termoView = {
          question: termo.question,
          options: termo.options,
          votes,
          pcts: percentages(votes),
          total: votes.reduce((sum, v) => sum + v, 0),
          cities: cities.slice(0, 5).map((city) => {
            const top = city.votes.indexOf(Math.max(...city.votes));
            return { label: city.label, total: city.total, top: termo.options[top]!, pct: percentages(city.votes)[top]! };
          }),
        };
      }
      return {
        edition: row.mesaEdition!,
        label: longDate(editionDate(first, row.mesaEdition!)),
        broadcastId: row.id,
        subject: row.subject,
        status: row.status as MesaSentView["status"],
        sent: s.sent,
        opened: s.opened,
        openRate: s.delivered > 0 ? Math.round((s.opened / s.delivered) * 100) : null,
        mito: mitoView,
        termometro: termoView,
      };
    }),
  );
}

// ── What the team does ──────────────────────────────────────────────────────

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

/** The send holding this piece's edition: a piece of the bank is held once
 * its edition is scheduled; a subject line, by its own edition. */
async function holder(piece: MesaPiece): Promise<MesaSendView | null> {
  if (piece.edition === null) return null;
  if (piece.section !== "ASUNTO" && piece.status !== "APPROVED") return null;
  return sendOf(piece.edition);
}

function outAlready(send: MesaSendView): MesaError {
  return new MesaError(send.status === "SENT" ? `La edición ${send.edition} ya salió: no se cambia.` : `La edición ${send.edition} está saliendo ahora: ya no se cambia.`);
}

/** The subject a scheduled send shows in the history, kept in step with the chosen one. */
async function syncSubject(send: MesaSendView | null, subjectContent: unknown): Promise<void> {
  const c = contentOf("ASUNTO", subjectContent);
  if (send?.status === "QUEUED" && c) await db.emailBroadcast.update({ where: { id: send.id }, data: { subject: c.subject } });
}

/** Into the bank: last in its section's order. A subject line becomes its
 * edition's (the one chosen before goes back among the options). */
export async function approvePiece(id: string): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status === "DISCARDED") throw new MesaError("Esa idea ya se descartó.");
  if (piece.section === "ASUNTO") {
    const send = await holder(piece);
    if (send && send.status !== "QUEUED") throw outAlready(send);
    await db.$transaction([
      db.mesaPiece.updateMany({ where: { section: "ASUNTO", edition: piece.edition, status: "APPROVED", id: { not: id } }, data: { status: "IDEA", approvedAt: null } }),
      db.mesaPiece.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } }),
    ]);
    await syncSubject(send, piece.content);
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

/** «Editar»: the team's words over Claude's — until its edition starts going out. */
export async function editPiece(id: string, content: unknown): Promise<void> {
  const piece = await pieceOrThrow(id);
  const send = await holder(piece);
  if (send && send.status !== "QUEUED") throw outAlready(send);
  const merged = piece.section === "ASUNTO" ? { ...(content as object), pieceIds: contentOf("ASUNTO", piece.content)?.pieceIds ?? [] } : content;
  const parsed = MESA_CONTENT[piece.section].safeParse(merged);
  if (!parsed.success) throw new MesaError("Revisa los campos: alguno quedó vacío o muy largo.");
  await db.mesaPiece.update({ where: { id }, data: { content: parsed.data as Prisma.InputJsonValue } });
  if (piece.section === "ASUNTO" && piece.status === "APPROVED") await syncSubject(send, parsed.data);
}

/** Out of the bank (it's never proposed again). */
export async function removePiece(id: string): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status !== "APPROVED") throw new MesaError("Esa pieza no está en el banco.");
  const send = await holder(piece);
  if (send) {
    if (send.status !== "QUEUED") throw outAlready(send);
    throw new MesaError(
      piece.section === "ASUNTO"
        ? `La edición ${send.edition} ya está programada: elige otro asunto en vez de quitarlo, o cancela el envío.`
        : `Esta pieza va en la edición ${send.edition}, que ya está programada: para cambiarla, primero cancela el envío.`,
    );
  }
  await db.mesaPiece.update({ where: { id }, data: { status: piece.section === "ASUNTO" ? "IDEA" : "DISCARDED", approvedAt: null } });
}

/** One place up or down in its section's order. */
export async function movePiece(id: string, direction: "up" | "down"): Promise<void> {
  const piece = await pieceOrThrow(id);
  if (piece.status !== "APPROVED" || piece.section === "ASUNTO") throw new MesaError("Esa pieza no está en el banco.");
  if (piece.edition !== null) throw new MesaError(`Esta pieza ya tiene su edición (la ${piece.edition}): no se mueve.`);
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
  const [first, send] = await Promise.all([getFirstEditionOn(), sendOf(edition)]);
  const next = nextEdition(first, bogotaDay(now));
  if (send && send.status !== "QUEUED") throw outAlready(send);
  if (!send && (edition < next || edition >= next + EDITIONS_AHEAD)) throw new MesaError("Los asuntos se piden para las próximas ediciones.");
  const pieces = await editionPieces(edition, now);
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
