import { createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cityKey, type MesaEditionSnapshot, type MesaTermometroResults } from "./email";
import { contentOf, editionDate, longDate } from "./sections";

// The answers tapped in La Mesa's email (2026-10-25). Each option in the
// email is a link signed for that person, piece and option
// (nailfest.lat/la-mesa/voto/<token>): one tap records it with the person
// (MesaVote), and tapping another option changes it. A preview's or a
// test's links are signed for nobody: they open the same page and record
// nothing. Here too, what the votes add up to: totals, by city.

const PREVIEW = "vista";
/** A city says something about itself from this many votes. */
export const MIN_CITY_VOTES = 20;

function sign(payload: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`mesa-vote.${payload}`).digest("base64url").slice(0, 27);
}

/** Her tap on that option; `personId` null for a preview or a test. */
export function voteToken(personId: string | null, pieceId: string, option: number): string {
  const payload = `${personId ?? PREVIEW}.${pieceId}.${option}`;
  return `${payload}.${sign(payload)}`;
}

export function voteUrl(token: string): string {
  return `${process.env.APP_BASE_URL ?? ""}/la-mesa/voto/${token}`;
}

export function readVoteToken(token: string): { personId: string | null; pieceId: string; option: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [who, pieceId, option, signature] = parts as [string, string, string, string];
  if (!who || !pieceId || !/^\d$/.test(option)) return null;
  const expected = Buffer.from(sign(`${who}.${pieceId}.${option}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { personId: who === PREVIEW ? null : who, pieceId, option: Number(option) };
}

// ── What they add up to ─────────────────────────────────────────────────────

/** Votes per option, in the options' order. */
export async function tally(pieceId: string, options: number): Promise<number[]> {
  const rows = await db.mesaVote.groupBy({ by: ["option"], where: { pieceId }, _count: { _all: true } });
  const votes = Array.from({ length: options }, () => 0);
  for (const row of rows) if (row.option >= 0 && row.option < options) votes[row.option] = row._count._all;
  return votes;
}

/** Votes per option in each city with at least `min` of them (accents and capitals don't split a city); the most voted first. */
export async function cityTally(pieceId: string, options: number, min = MIN_CITY_VOTES): Promise<MesaTermometroResults["byCity"]> {
  const rows = await db.$queryRaw<{ option: number; city: string | null; n: bigint }[]>(Prisma.sql`
    SELECT v.option, p.city, COUNT(*) AS n
    FROM "MesaVote" v JOIN "Person" p ON p.id = v."personId"
    WHERE v."pieceId" = ${pieceId}
    GROUP BY v.option, p.city
  `);
  const cities = new Map<string, { labels: Map<string, number>; votes: number[] }>();
  for (const row of rows) {
    const key = cityKey(row.city);
    if (!key || row.option < 0 || row.option >= options) continue;
    const city = cities.get(key) ?? { labels: new Map(), votes: Array.from({ length: options }, () => 0) };
    const n = Number(row.n);
    city.votes[row.option]! += n;
    const label = row.city!.trim();
    city.labels.set(label, (city.labels.get(label) ?? 0) + n);
    cities.set(key, city);
  }
  return [...cities.entries()]
    .map(([key, city]) => ({
      key,
      // The way most of them wrote it.
      label: [...city.labels.entries()].sort((a, b) => b[1] - a[1])[0]![0],
      votes: city.votes,
      total: city.votes.reduce((sum, v) => sum + v, 0),
    }))
    .filter((city) => city.total >= min)
    .sort((a, b) => b.total - a.total);
}

// ── A tap ───────────────────────────────────────────────────────────────────

type VotedPiece = { id: string; section: "MITO" | "TERMOMETRO"; edition: number; options: number };

async function votedPiece(pieceId: string): Promise<VotedPiece | null> {
  const piece = await db.mesaPiece.findUnique({ where: { id: pieceId } });
  if (!piece || piece.edition === null) return null;
  if (piece.section === "MITO") return contentOf("MITO", piece.content) ? { id: piece.id, section: "MITO", edition: piece.edition, options: 2 } : null;
  if (piece.section === "TERMOMETRO") {
    const c = contentOf("TERMOMETRO", piece.content);
    return c ? { id: piece.id, section: "TERMOMETRO", edition: piece.edition, options: c.options.length } : null;
  }
  return null;
}

/** Records her answer (or changes it). A preview's tap records nothing. */
export async function recordVote(token: string): Promise<"saved" | "preview" | "invalid"> {
  const read = readVoteToken(token);
  if (!read) return "invalid";
  const piece = await votedPiece(read.pieceId);
  if (!piece || read.option >= piece.options) return "invalid";
  if (read.personId === null) return "preview";
  const person = await db.person.findUnique({ where: { id: read.personId }, select: { id: true } });
  if (!person) return "invalid";
  await db.mesaVote.upsert({
    where: { pieceId_personId: { pieceId: piece.id, personId: person.id } },
    create: { pieceId: piece.id, personId: person.id, edition: piece.edition, option: read.option },
    update: { option: read.option },
  });
  return "saved";
}

export interface MesaVotePage {
  token: string;
  preview: boolean;
  edition: number;
  option: number;
  mito: { statement: string; answer: "mito" | "verdad"; explanation: string; right: boolean; rightPct: number | null } | null;
  termometro: {
    question: string;
    options: string[];
    /** "jueves 19 de noviembre": when La Mesa brings the results. */
    nextDate: string;
    /** Already out in a later edition: those results. */
    published: { votes: number[]; total: number } | null;
  } | null;
}

/** What the page a tap opens shows. Null: the link isn't one of ours. */
export async function votePage(token: string, firstEditionOn: Date): Promise<MesaVotePage | null> {
  const read = readVoteToken(token);
  if (!read) return null;
  const piece = await db.mesaPiece.findUnique({ where: { id: read.pieceId } });
  if (!piece || piece.edition === null) return null;
  const base = { token, preview: read.personId === null, edition: piece.edition, option: read.option };

  if (piece.section === "MITO") {
    const c = contentOf("MITO", piece.content);
    if (!c || read.option > 1) return null;
    const votes = await tally(piece.id, 2);
    const total = votes[0]! + votes[1]!;
    const rightIndex = c.answer === "mito" ? 0 : 1;
    return {
      ...base,
      mito: {
        statement: c.statement,
        answer: c.answer,
        explanation: c.explanation,
        right: read.option === rightIndex,
        rightPct: total >= MIN_CITY_VOTES ? Math.round((votes[rightIndex]! / total) * 100) : null,
      },
      termometro: null,
    };
  }

  if (piece.section === "TERMOMETRO") {
    const c = contentOf("TERMOMETRO", piece.content);
    if (!c || read.option >= c.options.length) return null;
    // A later edition that already brought these results.
    const later = await db.emailBroadcast.findMany({
      where: { mesaEdition: { gt: piece.edition, lte: piece.edition + 6 }, status: { in: ["SENDING", "SENT"] } },
      orderBy: { mesaEdition: "asc" },
      select: { mesaContent: true },
    });
    const results = later.map((b) => (b.mesaContent as unknown as MesaEditionSnapshot | null)?.results).find((r) => r?.pieceId === piece.id) ?? null;
    return {
      ...base,
      mito: null,
      termometro: {
        question: c.question,
        options: c.options,
        nextDate: longDate(editionDate(firstEditionOn, piece.edition + 1)),
        published: results ? { votes: results.votes, total: results.total } : null,
      },
    };
  }
  return null;
}
