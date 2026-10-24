import { z } from "zod";

// The Consultorio (nailfest.lat/consultorio, 2026-10-24): the community's
// questions and answers — where the conversations of the events go on.
// Anyone with a community account asks, answers and votes «Me sirvió»;
// whoever asked marks «La que me resolvió»; instructors answer with their
// portal account and show it; the team answers as "Equipo Nail Fest". No
// links and no phones, so it stays a place to help, not to sell. No
// database here: the forms import it too.

export const CONSULTORIO_TOPICS = [
  { key: "tecnica", label: "Técnica" },
  { key: "productos", label: "Productos" },
  { key: "salud", label: "Salud de la uña" },
  { key: "negocio", label: "Negocio" },
  { key: "eventos", label: "Eventos Nail Fest" },
] as const;

export type ConsultorioTopicKey = (typeof CONSULTORIO_TOPICS)[number]["key"];

export function isConsultorioTopic(value: unknown): value is ConsultorioTopicKey {
  return CONSULTORIO_TOPICS.some((t) => t.key === value);
}

export function consultorioTopicLabel(key: string): string {
  return CONSULTORIO_TOPICS.find((t) => t.key === key)?.label ?? "Otro";
}

/** The list's tabs: the most recent activity, the ones nobody answered yet,
 * the ones with the most useful answers. */
export const CONSULTORIO_TABS = [
  { key: "recientes", label: "Recientes" },
  { key: "sin-respuesta", label: "Sin respuesta" },
  { key: "utiles", label: "Más útiles" },
] as const;

export type ConsultorioTab = (typeof CONSULTORIO_TABS)[number]["key"];

export function isConsultorioTab(value: unknown): value is ConsultorioTab {
  return CONSULTORIO_TABS.some((t) => t.key === value);
}

// ── The insignia ────────────────────────────────────────────────────────────

/** «Ayuda en el Consultorio»: for whoever helps the most — three answers
 * marked «La que me resolvió», or ten «Me sirvió». */
export const INSIGNIA = { label: "Ayuda en el Consultorio", bestFrom: 3, usefulFrom: 10 } as const;

export function earnsInsignia(help: { best: number; useful: number }): boolean {
  return help.best >= INSIGNIA.bestFrom || help.useful >= INSIGNIA.usefulFrom;
}

// ── What can be posted ──────────────────────────────────────────────────────

export const TITLE_FROM = 10;
export const TITLE_UP_TO = 140;
export const BODY_UP_TO = 2000;
export const ANSWER_UP_TO = 2000;
/** A day's posts per person, at most: enough to take part, not to flood. */
export const QUESTIONS_PER_DAY = 5;
export const ANSWERS_PER_DAY = 30;

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|lat|shop|store|me|ly|link|info|io|app|site|online)\b)/i;
// Ten digits or more, spaces or dots between them allowed: a phone, not a price.
const PHONE = /(\+?\d[\s.-]?){10,}/;

/** Why a text can't go up, in words — no links and no phones; null when it can. */
export function contentProblem(text: string): string | null {
  if (LINK.test(text)) return "Para cuidar el Consultorio no se permiten enlaces ni correos.";
  if (PHONE.test(text)) return "Para cuidar el Consultorio no se permiten teléfonos.";
  return null;
}

const postText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .superRefine((value, ctx) => {
      const problem = contentProblem(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    });

const topicKeys = CONSULTORIO_TOPICS.map((t) => t.key) as [string, ...string[]];

export const questionSchema = z.object({
  topic: z.enum(topicKeys),
  title: postText(TITLE_FROM, TITLE_UP_TO),
  body: z
    .string()
    .max(BODY_UP_TO)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .superRefine((value, ctx) => {
      const problem = value ? contentProblem(value) : null;
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
  photoUrl: z.string().url().max(600).startsWith("https://").nullish(),
});

export const answerSchema = z.object({ body: postText(2, ANSWER_UP_TO) });

// ── Community accounts ──────────────────────────────────────────────────────

export const PASSWORD_FROM = 8;

export const memberSignupSchema = z.object({
  name: postText(2, 60),
  city: postText(2, 60),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(PASSWORD_FROM).max(200),
  acceptTerms: z.literal(true),
  // The honeypot: people never fill it in.
  website: z.string().max(200).optional(),
});

export const memberUpdateSchema = z.object({
  name: postText(2, 60).optional(),
  city: postText(2, 60).optional(),
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(PASSWORD_FROM).max(200).optional(),
});

/** The first field a form got wrong, and what to tell her. */
export function firstIssue(error: z.ZodError, messages: Record<string, string>): { field: string; message: string } {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "");
  const custom = issue?.code === "custom" ? issue.message : null;
  return { field, message: custom ?? messages[field] ?? "Revisa los datos." };
}

// ── Addresses and times ─────────────────────────────────────────────────────

/** A question's address, from its title: "¿Cómo hago…?" → "como-hago". */
export function questionSlugBase(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/g, "") || "pregunta"
  );
}

const shortDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días", then the date. */
export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  // "2 oct" whichever way this ICU writes it ("2 de oct.", "2 oct").
  return shortDate.format(then).replace(".", "").replace(" de ", " ");
}

/** "Sin respuestas", "1 respuesta", "3 respuestas". */
export function answersLabel(count: number): string {
  return count === 0 ? "Sin respuestas" : count === 1 ? "1 respuesta" : `${count} respuestas`;
}

/** Where to come back after entering: a page of the Consultorio or of the
 * account only — never anywhere else. */
export function safeReturn(value: unknown, fallback = "/consultorio"): string {
  const path = typeof value === "string" ? value : "";
  return /^\/(consultorio|cuenta)(\/[a-z0-9-]+)*(\?[a-z0-9=&-]*)?$/.test(path) ? path : fallback;
}

/** The Consultorio's rules, where people sign up and ask. */
export const CONSULTORIO_RULES = [
  "Pregunta lo que de verdad te pasa: con detalles y, si puedes, una foto.",
  "Responde con respeto: aquí todas aprendemos.",
  "Sin enlaces ni teléfonos: el Consultorio es para ayudar, no para vender.",
  "Lo que publicas sale con tu nombre y tu ciudad.",
  "El equipo de Nail Fest puede ocultar lo que no cumpla estas reglas.",
] as const;
