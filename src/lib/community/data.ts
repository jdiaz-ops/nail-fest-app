import type { CommunityMember, ConsultorioAuthor, Instructor, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isListed } from "@/lib/library/data";
import { initialOf, toneOf } from "@/lib/library/shared";
import { earnsInsignia, questionSlugBase, type ConsultorioTab } from "./consultorio";
import { wrote, type ConsultorioIdentity } from "./auth";

// What the Consultorio's pages read (nailfest.lat/consultorio): the list,
// a question with its answers, who wrote each one and whether they've
// earned the insignia — and what the team needs to look after it.

/** What people see: not hidden by the team, and not from a blocked member. */
export const visibleQuestion = { hidden: false, OR: [{ memberId: null }, { member: { blocked: false } }] } satisfies Prisma.ConsultorioQuestionWhereInput;
export const visibleAnswer = { hidden: false, OR: [{ memberId: null }, { member: { blocked: false } }] } satisfies Prisma.ConsultorioAnswerWhereInput;

export interface ConsultorioAuthorView {
  kind: ConsultorioAuthor;
  name: string;
  city: string | null;
  initial: string;
  tone: number;
  photoUrl: string | null;
  /** Her profile in the directory, when it's listed. */
  profileSlug: string | null;
  /** «Instructora del directorio». */
  instructor: boolean;
  /** «Ayuda en el Consultorio». */
  insignia: boolean;
}

type AuthorRow = { authorKind: ConsultorioAuthor; member: CommunityMember | null; instructor: Instructor | null; memberId: string | null; instructorId: string | null };

interface Help {
  members: Map<string, { best: number; useful: number }>;
  instructors: Map<string, { best: number; useful: number }>;
}

/** How much each of these people has helped: answers marked «La que me
 * resolvió» and «Me sirvió» received. */
async function helpOf(rows: { memberId: string | null; instructorId: string | null }[]): Promise<Help> {
  const memberIds = [...new Set(rows.map((r) => r.memberId).filter((id): id is string => Boolean(id)))];
  const instructorIds = [...new Set(rows.map((r) => r.instructorId).filter((id): id is string => Boolean(id)))];
  const help: Help = { members: new Map(), instructors: new Map() };
  if (memberIds.length === 0 && instructorIds.length === 0) return help;
  const [best, usefulByMember, usefulByInstructor] = await Promise.all([
    db.consultorioQuestion.findMany({
      where: { ...visibleQuestion, bestAnswer: { hidden: false, OR: [{ memberId: { in: memberIds } }, { instructorId: { in: instructorIds } }] } },
      select: { bestAnswer: { select: { memberId: true, instructorId: true } } },
    }),
    memberIds.length
      ? db.consultorioAnswer.groupBy({ by: ["memberId"], where: { memberId: { in: memberIds }, hidden: false }, _sum: { usefulCount: true } })
      : Promise.resolve([]),
    instructorIds.length
      ? db.consultorioAnswer.groupBy({ by: ["instructorId"], where: { instructorId: { in: instructorIds }, hidden: false }, _sum: { usefulCount: true } })
      : Promise.resolve([]),
  ]);
  const add = (map: Map<string, { best: number; useful: number }>, id: string, best: number, useful: number) => {
    const current = map.get(id) ?? { best: 0, useful: 0 };
    map.set(id, { best: current.best + best, useful: current.useful + useful });
  };
  for (const q of best) {
    if (q.bestAnswer?.memberId) add(help.members, q.bestAnswer.memberId, 1, 0);
    if (q.bestAnswer?.instructorId) add(help.instructors, q.bestAnswer.instructorId, 1, 0);
  }
  for (const r of usefulByMember) if (r.memberId) add(help.members, r.memberId, 0, r._sum.usefulCount ?? 0);
  for (const r of usefulByInstructor) if (r.instructorId) add(help.instructors, r.instructorId, 0, r._sum.usefulCount ?? 0);
  return help;
}

function authorView(row: AuthorRow, help: Help): ConsultorioAuthorView {
  if (row.authorKind === "INSTRUCTOR" && row.instructor) {
    const listed = isListed(row.instructor);
    const h = help.instructors.get(row.instructor.id);
    return {
      kind: "INSTRUCTOR",
      name: row.instructor.name,
      city: row.instructor.city || null,
      initial: initialOf(row.instructor.name),
      tone: toneOf(row.instructor.slug),
      photoUrl: row.instructor.photoUrl,
      profileSlug: listed ? row.instructor.slug : null,
      instructor: listed,
      insignia: h ? earnsInsignia(h) : false,
    };
  }
  if (row.authorKind === "MEMBER" && row.member) {
    const h = help.members.get(row.member.id);
    return {
      kind: "MEMBER",
      name: row.member.name,
      city: row.member.city,
      initial: initialOf(row.member.name),
      tone: toneOf(row.member.id),
      photoUrl: null,
      profileSlug: null,
      instructor: false,
      insignia: h ? earnsInsignia(h) : false,
    };
  }
  return { kind: "TEAM", name: "Equipo Nail Fest", city: null, initial: "NF", tone: 1, photoUrl: null, profileSlug: null, instructor: false, insignia: false };
}

const authorInclude = { member: true, instructor: true } satisfies Prisma.ConsultorioQuestionInclude;

// ── The list ────────────────────────────────────────────────────────────────

export interface QuestionCard {
  id: string;
  slug: string;
  title: string;
  topic: string;
  author: ConsultorioAuthorView;
  answerCount: number;
  solved: boolean;
  /** An instructor of the directory answered it. */
  instructorAnswered: boolean;
  hasPhoto: boolean;
  createdAt: string;
  lastActivityAt: string;
}

const LIST_UP_TO = 40;

export async function listQuestions({
  tab,
  topic,
  query,
  take = LIST_UP_TO,
}: {
  tab: ConsultorioTab;
  topic: string | null;
  query: string;
  take?: number;
}): Promise<QuestionCard[]> {
  const where: Prisma.ConsultorioQuestionWhereInput = {
    AND: [
      visibleQuestion,
      topic ? { topic } : {},
      query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }] } : {},
      tab === "sin-respuesta" ? { answerCount: 0 } : {},
    ],
  };
  const rows = await db.consultorioQuestion.findMany({
    where,
    orderBy: tab === "sin-respuesta" ? { createdAt: "desc" } : { lastActivityAt: "desc" },
    take: tab === "utiles" ? 200 : take,
    include: {
      ...authorInclude,
      answers: { where: visibleAnswer, select: { usefulCount: true, authorKind: true, instructor: { select: { visible: true, paused: true, approvedAt: true } } } },
    },
  });
  const ordered =
    tab === "utiles"
      ? rows
          .map((row) => ({ row, useful: row.answers.reduce((sum, a) => sum + a.usefulCount, 0) + (row.bestAnswerId ? 3 : 0) }))
          .filter((x) => x.useful > 0)
          .sort((a, b) => b.useful - a.useful || b.row.lastActivityAt.getTime() - a.row.lastActivityAt.getTime())
          .slice(0, take)
          .map((x) => x.row)
      : rows;
  const help = await helpOf(ordered);
  return ordered.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    author: authorView(row, help),
    answerCount: row.answerCount,
    solved: Boolean(row.bestAnswerId),
    instructorAnswered: row.answers.some((a) => a.authorKind === "INSTRUCTOR" && a.instructor && isListed(a.instructor)),
    hasPhoto: Boolean(row.photoUrl),
    createdAt: row.createdAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
  }));
}

/** The newest questions, for the community home. */
export function latestQuestions(take: number): Promise<QuestionCard[]> {
  return listQuestions({ tab: "recientes", topic: null, query: "", take });
}

export function countQuestions(): Promise<number> {
  return db.consultorioQuestion.count({ where: visibleQuestion });
}

// ── A question and its answers ──────────────────────────────────────────────

export interface AnswerView {
  id: string;
  body: string;
  author: ConsultorioAuthorView;
  usefulCount: number;
  best: boolean;
  /** This person said «Me sirvió». */
  voted: boolean;
  /** This person wrote it (no voting for one's own). */
  mine: boolean;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  photoUrl: string | null;
  topic: string;
  author: ConsultorioAuthorView;
  hidden: boolean;
  createdAt: string;
  answers: AnswerView[];
  /** Whoever asked (or the team) can mark «La que me resolvió». */
  canMarkBest: boolean;
}

export async function getThread(slug: string, identity: ConsultorioIdentity | null, staff: boolean): Promise<ThreadView | null> {
  const question = await db.consultorioQuestion.findUnique({ where: { slug }, include: authorInclude });
  if (!question) return null;
  const blocked = question.member?.blocked ?? false;
  if ((question.hidden || blocked) && !staff) return null;

  const voter =
    identity?.kind === "MEMBER" ? { memberId: identity.member.id } : identity?.kind === "INSTRUCTOR" ? { instructorId: identity.instructor.id } : identity?.kind === "TEAM" ? { adminUserId: identity.adminUserId } : null;
  const answers = await db.consultorioAnswer.findMany({
    where: { questionId: question.id, ...visibleAnswer },
    orderBy: { createdAt: "asc" },
    include: { ...authorInclude, votes: voter ? { where: voter, select: { id: true } } : { where: { id: "none" }, select: { id: true } } },
  });
  const help = await helpOf([question, ...answers]);
  const views = answers.map(
    (a): AnswerView => ({
      id: a.id,
      body: a.body,
      author: authorView(a, help),
      usefulCount: a.usefulCount,
      best: a.id === question.bestAnswerId,
      voted: a.votes.length > 0,
      mine: wrote(identity, a),
      createdAt: a.createdAt.toISOString(),
    }),
  );
  // «La que me resolvió» first, then the most useful, then the oldest.
  views.sort((x, y) => Number(y.best) - Number(x.best) || y.usefulCount - x.usefulCount || x.createdAt.localeCompare(y.createdAt));
  return {
    id: question.id,
    slug: question.slug,
    title: question.title,
    body: question.body,
    photoUrl: question.photoUrl,
    topic: question.topic,
    author: authorView(question, help),
    hidden: question.hidden || blocked,
    createdAt: question.createdAt.toISOString(),
    answers: views,
    canMarkBest: identity?.kind === "TEAM" || wrote(identity, question),
  };
}

// ── Keeping things in step ──────────────────────────────────────────────────

/** A free address for a new question. */
export async function uniqueQuestionSlug(title: string): Promise<string> {
  const base = questionSlugBase(title);
  const root = base === "preguntar" ? "pregunta-preguntar" : base;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await db.consultorioQuestion.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
}

/** Each question's count of the answers people see. */
export async function recountAnswers(questionIds: string[]): Promise<void> {
  for (const id of [...new Set(questionIds)]) {
    const count = await db.consultorioAnswer.count({ where: { questionId: id, ...visibleAnswer } });
    await db.consultorioQuestion.update({ where: { id }, data: { answerCount: count } });
  }
}

/** Posts this person made since a moment — the day's limit. */
export async function postsSince(identity: ConsultorioIdentity, since: Date): Promise<{ questions: number; answers: number }> {
  const who =
    identity.kind === "MEMBER" ? { memberId: identity.member.id } : identity.kind === "INSTRUCTOR" ? { instructorId: identity.instructor.id } : { adminUserId: identity.adminUserId };
  const [questions, answers] = await Promise.all([
    db.consultorioQuestion.count({ where: { ...who, createdAt: { gte: since } } }),
    db.consultorioAnswer.count({ where: { ...who, createdAt: { gte: since } } }),
  ]);
  return { questions, answers };
}

// ── For the team (/admin/consultorio) ───────────────────────────────────────

// Written here, not in the admin's page: the browser's own Intl spaces "p. m."
// differently from the server's, and the page would not match its HTML.
const adminWhen = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export interface AdminPost {
  kind: "question" | "answer";
  id: string;
  questionSlug: string;
  questionTitle: string;
  text: string;
  author: string;
  memberId: string | null;
  memberBlocked: boolean;
  hidden: boolean;
  createdAt: string;
  /** "24 de oct, 6:12 p. m." */
  createdLabel: string;
}

export interface AdminMember {
  id: string;
  name: string;
  city: string;
  email: string;
  blocked: boolean;
  questions: number;
  answers: number;
  resetRequestedAt: string | null;
  resetRequestedLabel: string | null;
  createdLabel: string;
}

export async function getConsultorioAdminData() {
  const [questions, answers, members, counts] = await Promise.all([
    db.consultorioQuestion.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: authorInclude }),
    db.consultorioAnswer.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { ...authorInclude, question: { select: { slug: true, title: true } } } }),
    db.communityMember.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { questions: true, answers: true } } } }),
    Promise.all([db.consultorioQuestion.count(), db.consultorioAnswer.count(), db.communityMember.count()]),
  ]);
  const name = (row: AuthorRow) =>
    row.authorKind === "TEAM" ? "Equipo Nail Fest" : row.authorKind === "INSTRUCTOR" ? `${row.instructor?.name ?? "Instructora"} (instructora)` : `${row.member?.name ?? "—"} · ${row.member?.city ?? ""}`;
  const posts: AdminPost[] = [
    ...questions.map(
      (q): AdminPost => ({
        kind: "question",
        id: q.id,
        questionSlug: q.slug,
        questionTitle: q.title,
        text: q.body ? `${q.title} — ${q.body}` : q.title,
        author: name(q),
        memberId: q.memberId,
        memberBlocked: q.member?.blocked ?? false,
        hidden: q.hidden,
        createdAt: q.createdAt.toISOString(),
        createdLabel: adminWhen.format(q.createdAt),
      }),
    ),
    ...answers.map(
      (a): AdminPost => ({
        kind: "answer",
        id: a.id,
        questionSlug: a.question.slug,
        questionTitle: a.question.title,
        text: a.body,
        author: name(a),
        memberId: a.memberId,
        memberBlocked: a.member?.blocked ?? false,
        hidden: a.hidden,
        createdAt: a.createdAt.toISOString(),
        createdLabel: adminWhen.format(a.createdAt),
      }),
    ),
  ]
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .slice(0, 80);
  return {
    posts,
    members: members.map(
      (m): AdminMember => ({
        id: m.id,
        name: m.name,
        city: m.city,
        email: m.email,
        blocked: m.blocked,
        questions: m._count.questions,
        answers: m._count.answers,
        resetRequestedAt: m.resetRequestedAt?.toISOString() ?? null,
        resetRequestedLabel: m.resetRequestedAt ? adminWhen.format(m.resetRequestedAt) : null,
        createdLabel: adminWhen.format(m.createdAt),
      }),
    ),
    counts: { questions: counts[0], answers: counts[1], members: counts[2] },
  };
}

export type ConsultorioAdminData = Awaited<ReturnType<typeof getConsultorioAdminData>>;
