import type { Person } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { visibleAnswer, visibleQuestion } from "@/lib/community/data";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { bogotaDay } from "@/lib/library/data";
import { getLibrarySettings } from "@/lib/library/settings";
import { QSTASH_MAX_DELAY_MS, cancelScheduledSend, scheduleEventBroadcastSend } from "@/lib/qstash";
import { getOrgSettings } from "@/lib/settings";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { EDITIONS_AHEAD, MesaError, editionPieces, getFirstEditionOn, mesaSends, sendOf, type MesaSendView } from "./data";
import { mesaEmail, type MesaConsultorioBlock, type MesaEditionSnapshot, type MesaRecipient, type MesaTermometroResults } from "./email";
import { MESA_SECTIONS, contentOf, editionDate, longDate, nextEdition, tinyDate } from "./sections";
import { cityTally, tally, voteToken, voteUrl } from "./votes";

// La Mesa through Broadcasts (2026-10-25): an edition is scheduled to a
// segment at a day and time — an EmailBroadcast with its mesaEdition,
// QUEUED, AT_DATETIME — and then it's the broadcasts' own machinery that
// sends it (lib/broadcasts.ts: the cron or QStash at the exact time, in
// chunks, MARKETING consent, the unsubscribe link, the stats and the
// retries). Scheduling pins the edition's pieces to it; cancelling before
// it starts lets them go back to the queue. Nothing goes out that the team
// didn't schedule. Here too: the edition frozen for the email, the preview
// and the test.

/** 7:00 a. m. in Bogotá (UTC−5 all year): when an edition goes out unless the team picks another time. */
export const MESA_SEND_HOUR_UTC = 12;
/** The sender's name in the inbox. */
export const MESA_FROM_NAME = "La Mesa · Nail Fest";
/** Who the preview and a test to an address outside the CRM are for. */
export const MESA_SAMPLE = { firstName: "Laura", city: "Cúcuta" };
const DAY_MS = 86_400_000;
/** A send is scheduled at least this far ahead. */
const LEAD_MS = 2 * 60_000;
/** El Consultorio's block looks back this far: its most commented question, the ones waiting. */
const CONSULTORIO_FEATURED_DAYS = 14;
const CONSULTORIO_WAITING_DAYS = 30;

export function mesaBaseUrl(): string {
  return process.env.APP_BASE_URL || "https://nailfest.lat";
}

/** Edition n's usual time: its Thursday, 7:00 a. m. in Bogotá. */
export function defaultSendAt(firstEditionOn: Date, edition: number): Date {
  return new Date(editionDate(firstEditionOn, edition).getTime() + MESA_SEND_HOUR_UTC * 3_600_000);
}

// ── The edition, frozen ─────────────────────────────────────────────────────

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

type Authored = { authorKind: string; member: { name: string; city: string } | null; instructor: { name: string; city: string | null } | null };
function authorOf(row: Authored): { name: string; city: string | null } {
  if (row.authorKind === "INSTRUCTOR" && row.instructor) return { name: row.instructor.name, city: row.instructor.city || null };
  if (row.authorKind === "MEMBER" && row.member) return { name: row.member.name, city: row.member.city || null };
  return { name: "Equipo Nail Fest", city: null };
}

/** El Consultorio's block: the most commented question of these two weeks
 * with its best (or most useful) answer, and the newest ones still waiting
 * for answers. */
async function consultorioBlock(now: Date): Promise<MesaConsultorioBlock> {
  const [featured] = await db.consultorioQuestion.findMany({
    where: { ...visibleQuestion, answerCount: { gt: 0 }, lastActivityAt: { gte: new Date(now.getTime() - CONSULTORIO_FEATURED_DAYS * DAY_MS) } },
    orderBy: [{ answerCount: "desc" }, { lastActivityAt: "desc" }],
    take: 1,
    include: { bestAnswer: { include: { member: true, instructor: true } } },
  });
  let answer = featured?.bestAnswer && !featured.bestAnswer.hidden && !featured.bestAnswer.member?.blocked ? featured.bestAnswer : null;
  if (featured && !answer) {
    answer = await db.consultorioAnswer.findFirst({
      where: { questionId: featured.id, ...visibleAnswer },
      orderBy: [{ usefulCount: "desc" }, { createdAt: "asc" }],
      include: { member: true, instructor: true },
    });
  }
  const waiting = await db.consultorioQuestion.findMany({
    where: { ...visibleQuestion, answerCount: { lte: 1 }, createdAt: { gte: new Date(now.getTime() - CONSULTORIO_WAITING_DAYS * DAY_MS) }, ...(featured ? { id: { not: featured.id } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { member: true, instructor: true },
  });
  return {
    featured: featured
      ? {
          slug: featured.slug,
          title: featured.title,
          answers: featured.answerCount,
          answer: answer ? { author: authorOf(answer).name, city: authorOf(answer).city, body: clip(answer.body, 240) } : null,
        }
      : null,
    waiting: waiting.map((q) => ({ slug: q.slug, title: q.title, author: authorOf(q).name, city: authorOf(q).city, answers: q.answerCount })),
  };
}

/** El termómetro of the last edition that went out before this one, with its votes now. */
async function lastResults(edition: number): Promise<{ results: MesaTermometroResults | null; first: boolean }> {
  const previous = await db.emailBroadcast.findFirst({
    where: { mesaEdition: { lt: edition }, status: { in: ["SENDING", "SENT"] } },
    orderBy: { mesaEdition: "desc" },
    select: { mesaEdition: true, mesaContent: true },
  });
  if (!previous) return { results: null, first: true };
  const piece = (previous.mesaContent as unknown as MesaEditionSnapshot | null)?.pieces.find((p) => p.section === "TERMOMETRO");
  const c = piece ? contentOf("TERMOMETRO", piece.content) : null;
  if (!piece || !c) return { results: null, first: false };
  const [votes, byCity] = await Promise.all([tally(piece.id, c.options.length), cityTally(piece.id, c.options.length)]);
  return {
    results: { pieceId: piece.id, edition: previous.mesaEdition!, question: c.question, options: c.options, votes, total: votes.reduce((sum, v) => sum + v, 0), byCity },
    first: false,
  };
}

/** Everything edition n's email carries, as of now: its pieces, its subject
 * line, last time's results, El Consultorio and the doors that are public.
 * Throws (MesaError) while a piece or the subject is missing. */
export async function buildMesaSnapshot(edition: number, now: Date = new Date()): Promise<MesaEditionSnapshot> {
  const [first, slots, subjectRow] = await Promise.all([
    getFirstEditionOn(),
    editionPieces(edition, now),
    db.mesaPiece.findFirst({ where: { section: "ASUNTO", edition, status: "APPROVED" } }),
  ]);
  const missing = slots.filter((s) => !s.piece).map((s) => MESA_SECTIONS[s.section].name);
  if (missing.length) throw new MesaError(`A la edición ${edition} le falta: ${missing.join(", ")}.`);
  const subject = subjectRow ? contentOf("ASUNTO", subjectRow.content) : null;
  if (!subject) throw new MesaError(`Elige el asunto de la edición ${edition}.`);
  if (subject.pieceIds.join("|") !== slots.map((s) => s.piece!.id).join("|")) throw new MesaError(`Cambiaron las piezas de la edición ${edition}: elige un asunto nuevo.`);

  const [last, library, cuponera, org] = await Promise.all([lastResults(edition), getLibrarySettings(), getCuponeraSettings(), getOrgSettings()]);
  const day = editionDate(first, edition);
  return {
    edition,
    date: longDate(day),
    dateShort: tinyDate(day),
    subject: subject.subject,
    preheader: subject.preheader,
    intro: subject.intro,
    pieces: slots.map((s) => ({ id: s.piece!.id, section: s.section, content: s.piece!.content })),
    results: last.results,
    firstTermometro: last.first,
    consultorio: library.consultorioPublished ? await consultorioBlock(now) : null,
    doors: { consultorio: library.consultorioPublished, instructoras: library.instructorsPublished, cuponera: cuponera.published },
    replies: Boolean(org.replyToEmail),
  };
}

/** The edition as it went out, once it started; as it would go out now, before. */
export async function snapshotFor(edition: number, now: Date = new Date()): Promise<MesaEditionSnapshot> {
  const frozen = await db.emailBroadcast.findFirst({ where: { mesaEdition: edition, status: { in: ["SENDING", "SENT"] } }, select: { mesaContent: true } });
  return frozen?.mesaContent ? (frozen.mesaContent as unknown as MesaEditionSnapshot) : buildMesaSnapshot(edition, now);
}

/** Her links: her name, her city, her votes and her way out. */
export function recipientFor(person: Pick<Person, "id" | "firstName" | "city">): MesaRecipient {
  return {
    firstName: person.firstName,
    city: person.city,
    voteUrl: (pieceId, option) => voteUrl(voteToken(person.id, pieceId, option)),
    unsubscribeUrl: buildUnsubscribeUrl(person.id),
  };
}

/** A preview's or a test's: the votes record nothing, the way out goes nowhere. */
export function previewRecipient(who: { firstName: string | null; city: string | null } = MESA_SAMPLE): MesaRecipient {
  return { firstName: who.firstName, city: who.city, voteUrl: (pieceId, option) => voteUrl(voteToken(null, pieceId, option)), unsubscribeUrl: null };
}

/** «Ver el correo»: the email as it reaches Laura, from Cúcuta, with a band that says so. */
export async function previewHtml(edition: number, now: Date = new Date()): Promise<string> {
  const email = mesaEmail(await snapshotFor(edition, now), previewRecipient(), { baseUrl: mesaBaseUrl() });
  const band = `<div style="position:sticky;top:0;z-index:2;padding:10px 16px;background:#17181c;color:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;text-align:center;">Vista previa de la edición ${edition} · Asunto: <b>${email.subject.replace(/</g, "&lt;")}</b> · Así le llega a ${MESA_SAMPLE.firstName}, de ${MESA_SAMPLE.city}: cada persona ve su nombre y su ciudad. Los botones de aquí no guardan votos.</div>`;
  return email.html.replace(/<body([^>]*)>/, `<body$1>${band}`);
}

/** «Enviarme una prueba»: the edition to one address, marked as a test; its votes record nothing. */
export async function sendMesaTest(edition: number, address: string, now: Date = new Date()): Promise<void> {
  const to = address.trim().toLowerCase();
  const [snapshot, person] = await Promise.all([snapshotFor(edition, now), db.person.findUnique({ where: { email: to }, select: { firstName: true, city: true } })]);
  const email = mesaEmail(snapshot, previewRecipient(person ?? MESA_SAMPLE), { baseUrl: mesaBaseUrl() });
  await emailProvider.sendMarketing({ to, subject: `[Prueba] ${email.subject}`, text: email.text, html: email.html, fromName: MESA_FROM_NAME });
}

// ── Scheduling ──────────────────────────────────────────────────────────────

/** «Programar el envío»: edition n to a segment, at that time. Its pieces
 * stay with it from now on (cancelling lets them go). */
export async function scheduleMesaSend(input: { edition: number; segmentId: string; scheduledAt: Date }, now: Date = new Date()): Promise<{ id: string }> {
  const { edition, segmentId, scheduledAt } = input;
  const first = await getFirstEditionOn();
  const next = nextEdition(first, bogotaDay(now));
  if (edition < next || edition >= next + EDITIONS_AHEAD) throw new MesaError("Solo se programan las próximas ediciones.");
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < now.getTime() + LEAD_MS) throw new MesaError("Elige una fecha y hora que todavía no haya pasado.");
  const following = editionDate(first, edition + 1);
  if (scheduledAt.getTime() >= following.getTime()) throw new MesaError(`Elige un día antes de la edición siguiente (${longDate(following)}).`);
  const existing = await sendOf(edition);
  if (existing) throw new MesaError(existing.status === "QUEUED" ? `La edición ${edition} ya está programada.` : `La edición ${edition} ya salió.`);
  const segment = await db.segmentDefinition.findUnique({ where: { id: segmentId }, select: { id: true } });
  if (!segment) throw new MesaError("Ese segmento ya no existe: elige otro.");

  const slots = await editionPieces(edition, now);
  if (!slots.every((s) => s.piece)) throw new MesaError(`A la edición ${edition} todavía le faltan piezas.`);
  const ids = slots.map((s) => s.piece!.id);
  const subjectRow = await db.mesaPiece.findFirst({ where: { section: "ASUNTO", edition, status: "APPROVED" } });
  const subject = subjectRow ? contentOf("ASUNTO", subjectRow.content) : null;
  if (!subject) throw new MesaError(`Elige el asunto de la edición ${edition}.`);
  if (subject.pieceIds.join("|") !== ids.join("|")) throw new MesaError(`Cambiaron las piezas de la edición ${edition}: elige un asunto nuevo.`);

  const broadcast = await db.$transaction(async (tx) => {
    const taken = await tx.emailBroadcast.count({ where: { mesaEdition: edition, status: { in: ["QUEUED", "SENDING", "SENT"] } } });
    if (taken > 0) throw new MesaError(`La edición ${edition} ya está programada.`);
    const pinned = await tx.mesaPiece.updateMany({ where: { id: { in: ids }, status: "APPROVED", edition: null }, data: { edition } });
    if (pinned.count !== ids.length) throw new MesaError("Las piezas cambiaron mientras tanto: recarga la página y vuelve a intentarlo.");
    return tx.emailBroadcast.create({
      data: { segmentId, subject: subject.subject, mesaEdition: edition, status: "QUEUED", scheduleKind: "AT_DATETIME", scheduledAt },
    });
  });
  // Its call at the exact time when it's within QStash's reach; otherwise the
  // 5-minute cron arms it later, and sends it anyway if that call never comes.
  if (scheduledAt.getTime() - now.getTime() <= QSTASH_MAX_DELAY_MS) {
    const qstashMessageId = await scheduleEventBroadcastSend(broadcast.id, scheduledAt);
    if (qstashMessageId) await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { qstashMessageId } });
  }
  return { id: broadcast.id };
}

/** «Cancelar el envío», while it hasn't started: its pieces go back to the queue, in their places. */
export async function cancelMesaSend(edition: number): Promise<void> {
  const send = await sendOf(edition);
  if (!send) throw new MesaError(`La edición ${edition} no está programada.`);
  if (send.status !== "QUEUED") throw new MesaError(send.status === "SENT" ? `La edición ${edition} ya salió.` : `La edición ${edition} ya empezó a salir: no se puede cancelar.`);
  const row = await db.$transaction(async (tx) => {
    const cancelled = await tx.emailBroadcast.updateMany({ where: { id: send.id, status: "QUEUED" }, data: { status: "CANCELLED" } });
    if (cancelled.count === 0) throw new MesaError(`La edición ${edition} ya empezó a salir: no se puede cancelar.`);
    await tx.mesaPiece.updateMany({ where: { edition, status: "APPROVED", section: { not: "ASUNTO" } }, data: { edition: null } });
    return tx.emailBroadcast.findUnique({ where: { id: send.id }, select: { qstashMessageId: true } });
  });
  if (row?.qstashMessageId) await cancelScheduledSend(row.qstashMessageId);
}

// ── On the Broadcasts page ──────────────────────────────────────────────────

export interface MesaCardView {
  edition: number;
  /** "jueves 5 de noviembre" */
  label: string;
  state: "faltan" | "lista" | "programada" | "saliendo";
  /** What it still needs: pieces and the subject line. */
  left: number;
  send: MesaSendView | null;
}

/** The next edition that hasn't gone out, and where it stands. */
export async function getMesaCard(now: Date = new Date()): Promise<MesaCardView> {
  const [first, sends] = await Promise.all([getFirstEditionOn(), mesaSends()]);
  const waiting = [...sends.values()].filter((s) => s.status !== "SENT").map((s) => s.edition);
  let edition = Math.min(nextEdition(first, bogotaDay(now)), ...waiting);
  while (sends.get(edition)?.status === "SENT") edition++;
  const send = sends.get(edition) ?? null;
  const [slots, subjectRow] = await Promise.all([editionPieces(edition, now), db.mesaPiece.findFirst({ where: { section: "ASUNTO", edition, status: "APPROVED" } })]);
  const subject = subjectRow ? contentOf("ASUNTO", subjectRow.content) : null;
  const subjectOk = subject !== null && subject.pieceIds.join("|") === slots.map((s) => s.piece?.id ?? "").join("|");
  const left = slots.filter((s) => !s.piece).length + (subjectOk ? 0 : 1);
  return {
    edition,
    label: longDate(editionDate(first, edition)),
    state: send ? (send.status === "QUEUED" ? "programada" : "saliendo") : left === 0 ? "lista" : "faltan",
    left,
    send,
  };
}
