import type { Person } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { visibleAnswer, visibleQuestion } from "@/lib/community/data";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { getLibrarySettings } from "@/lib/library/settings";
import { getOrgSettings } from "@/lib/settings";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { MesaError, editionPieces, getFirstEditionOn } from "./data";
import { mesaEmail, type MesaConsultorioBlock, type MesaEditionSnapshot, type MesaRecipient, type MesaTermometroResults } from "./email";
import { MESA_SECTIONS, contentOf, editionDate, longDate, tinyDate } from "./sections";
import { cityTally, tally, voteToken, voteUrl } from "./votes";

// La Mesa's template (2026-10-25): everything an edition's email carries,
// frozen in one object (buildMesaSnapshot), and that email for one person —
// her name, her city's results, her signed vote links, her way out — or for
// the team's look at it («Ver el correo», «Enviarme una prueba», whose
// votes record nothing). La Mesa only builds the template; when an
// EmailBroadcast carries a mesaEdition, lib/broadcasts.ts sends this email
// with the broadcasts' own machinery (chunks, MARKETING consent, the
// unsubscribe link, the stats and the retries).

/** Who the preview and a test to an address outside the CRM are for. */
export const MESA_SAMPLE = { firstName: "Laura", city: "Cúcuta" };
const DAY_MS = 86_400_000;
/** El Consultorio's block looks back this far: its most commented question, the ones waiting. */
const CONSULTORIO_FEATURED_DAYS = 14;
const CONSULTORIO_WAITING_DAYS = 30;

export function mesaBaseUrl(): string {
  return process.env.APP_BASE_URL || "https://nailfest.lat";
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
  await emailProvider.sendMarketing({ to, subject: `[Prueba] ${email.subject}`, text: email.text, html: email.html });
}
