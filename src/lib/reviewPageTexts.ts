import { db } from "@/lib/db";
import { ORG_SETTINGS_ID } from "@/lib/settings";

// Every line of copy on the attendee-facing review pages (/resena/<token>:
// the form, the thanks page and the three "can't review" messages), each
// with a default and an admin override (OrgSettings.reviewPageTexts,
// edited at /admin/resenas/textos). Placeholders: {{nombre}} (the
// attendee's first name), {{evento}} (the edition, "Nail Fest Cúcuta
// 2026"), {{premios}} ("3 kit de marcas") and {{fecha}} (the raffle's
// closing day) — see fillReviewText.


export type ReviewTextPage = "form" | "thanks" | "messages";

export interface ReviewTextField {
  key: ReviewTextKey;
  page: ReviewTextPage;
  label: string;
  default: string;
  /** A textarea in the editor (long copy) rather than one line. */
  multiline?: boolean;
  /** Something the page shows only when this is non-empty. */
  optional?: boolean;
  /** The placeholders this field may use, listed in the editor. */
  placeholders?: string[];
}

export type ReviewTextKey =
  | "formEyebrow"
  | "formTitle"
  | "formIntro"
  | "ratingLabel"
  | "commentLabel"
  | "commentHint"
  | "commentPlaceholder"
  | "photosLabel"
  | "photosHint"
  | "instagramLabel"
  | "instagramHint"
  | "consentText"
  | "raffleOptInText"
  | "submitLabel"
  | "formFootnote"
  | "thanksTitle"
  | "thanksIntro"
  | "rewardEyebrow"
  | "rewardTitle"
  | "rewardText"
  | "raffleEyebrow"
  | "raffleInTitle"
  | "raffleOutTitle"
  | "raffleText"
  | "cardTitle"
  | "cardText"
  | "cardButton"
  | "backLink"
  | "invalidLink"
  | "notConfirmed"
  | "notAttended";

const EVENT = ["{{evento}}"];
const NAME_EVENT = ["{{nombre}}", "{{evento}}"];
const RAFFLE = ["{{evento}}", "{{premios}}", "{{fecha}}"];

export const REVIEW_TEXT_FIELDS: ReviewTextField[] = [
  // ── El formulario ──
  { key: "formEyebrow", page: "form", label: "Etiqueta arriba a la derecha", default: "Tu reseña" },
  { key: "formTitle", page: "form", label: "Título", default: "Hola {{nombre}}, ¿cómo estuvo {{evento}}?", placeholders: NAME_EVENT },
  { key: "formIntro", page: "form", label: "Texto bajo el título", default: "Tu opinión se publica con tu nombre y ciudad para que otras manicuristas sepan qué esperar. Toma un minuto.", multiline: true, placeholders: NAME_EVENT },
  { key: "ratingLabel", page: "form", label: "Etiqueta de las estrellas", default: "Tu calificación" },
  { key: "commentLabel", page: "form", label: "Etiqueta del comentario", default: "Cuéntanos tu experiencia" },
  { key: "commentHint", page: "form", label: "Nota junto a la etiqueta del comentario", default: "(opcional)" },
  { key: "commentPlaceholder", page: "form", label: "Texto gris dentro del comentario", default: "Las demostraciones, las marcas que encontraste, lo que más te gustó…" },
  { key: "photosLabel", page: "form", label: "Etiqueta de las fotos", default: "Sube hasta 3 fotos" },
  { key: "photosHint", page: "form", label: "Nota junto a la etiqueta de las fotos", default: "(tus uñas, el evento, tu equipo)" },
  { key: "instagramLabel", page: "form", label: "Etiqueta del Instagram", default: "Tu Instagram" },
  { key: "instagramHint", page: "form", label: "Nota junto a la etiqueta del Instagram", default: "(opcional, sale en tu reseña destacada)" },
  { key: "consentText", page: "form", label: "Casilla de permiso para publicar", default: "Autorizo a Nail Fest a publicar mi reseña con mi nombre, ciudad y fotos en su sitio, redes y publicidad. Puedo retirar este permiso cuando quiera escribiéndonos. Sin esta casilla tu calificación cuenta igual, pero no se muestra con tu nombre.", multiline: true },
  { key: "raffleOptInText", page: "form", label: "Casilla del sorteo (solo mientras el sorteo está abierto)", default: "Quiero participar en el sorteo de {{evento}}: {{premios}} entre las reseñas recibidas hasta el {{fecha}}. Participa toda reseña enviada a tiempo, sin importar la calificación.", multiline: true, placeholders: RAFFLE },
  { key: "submitLabel", page: "form", label: "Botón de enviar", default: "Enviar mi reseña" },
  { key: "formFootnote", page: "form", label: "Nota bajo el botón", default: "Solo pueden reseñar las asistentes escaneadas en la puerta. Tu reseña se publica después de una revisión del equipo.", multiline: true },
  // ── La pantalla de gracias ──
  { key: "thanksTitle", page: "thanks", label: "Título", default: "¡Gracias, {{nombre}}!", placeholders: NAME_EVENT },
  { key: "thanksIntro", page: "thanks", label: "Texto bajo el título", default: "Tu reseña quedó registrada con el sello Asistió a {{evento}}. La revisamos y la publicamos en los próximos días.", multiline: true, placeholders: NAME_EVENT },
  { key: "rewardEyebrow", page: "thanks", label: "Recompensa · etiqueta pequeña", default: "", optional: true },
  { key: "rewardTitle", page: "thanks", label: "Recompensa · título (la caja solo sale si escribes algo aquí)", default: "", optional: true, placeholders: EVENT },
  { key: "rewardText", page: "thanks", label: "Recompensa · texto", default: "", optional: true, multiline: true, placeholders: EVENT },
  { key: "raffleEyebrow", page: "thanks", label: "Sorteo · etiqueta pequeña", default: "Sorteo · {{evento}}", placeholders: EVENT },
  { key: "raffleInTitle", page: "thanks", label: "Sorteo · título si participa", default: "Estás participando" },
  { key: "raffleOutTitle", page: "thanks", label: "Sorteo · título si no participa", default: "No estás participando" },
  { key: "raffleText", page: "thanks", label: "Sorteo · texto", default: "{{premios}} entre las reseñas recibidas hasta el {{fecha}}. Las ganadoras se anuncian por WhatsApp e Instagram.", multiline: true, placeholders: RAFFLE },
  { key: "cardTitle", page: "thanks", label: "Tarjeta de Instagram · título", default: "Comparte tu reseña en Instagram" },
  { key: "cardText", page: "thanks", label: "Tarjeta de Instagram · texto", default: "Tarjeta lista para tu historia, con tu @ y tu calificación.", multiline: true },
  { key: "cardButton", page: "thanks", label: "Tarjeta de Instagram · botón", default: "Descargar tarjeta" },
  { key: "backLink", page: "thanks", label: "Enlace final", default: "Volver a nailfest.lat" },
  // ── Cuando no puede reseñar ──
  { key: "invalidLink", page: "messages", label: "Enlace que no es válido", default: "Este enlace no es válido. Abre el enlace exactamente como te llegó por WhatsApp o correo.", multiline: true },
  { key: "notConfirmed", page: "messages", label: "Inscripción sin confirmar", default: "Tu inscripción no aparece confirmada, así que todavía no puedes dejar una reseña.", multiline: true },
  { key: "notAttended", page: "messages", label: "No fue escaneada en la puerta", default: "Las reseñas son solo para quienes entraron al evento con su entrada escaneada. Si fuiste y ves este mensaje, escríbenos por WhatsApp y lo revisamos.", multiline: true },
];

export const REVIEW_TEXT_PAGES: { page: ReviewTextPage; title: string; blurb: string }[] = [
  { page: "form", title: "El formulario", blurb: "Lo que ve la asistente al abrir su enlace personal." },
  { page: "thanks", title: "La pantalla de gracias", blurb: "Después de enviar, y cada vez que vuelva a abrir el enlace." },
  { page: "messages", title: "Cuando no puede reseñar", blurb: "Mensajes de un enlace inválido, una inscripción sin confirmar o alguien que no fue escaneada." },
];

export type ReviewPageTexts = Record<ReviewTextKey, string>;

const MAX_TEXT_LENGTH = 600;

/** The stored override map (never the defaults) — what the editor edits. */
export function parseReviewTextOverrides(raw: unknown): Partial<ReviewPageTexts> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<ReviewPageTexts> = {};
  for (const field of REVIEW_TEXT_FIELDS) {
    const v = (raw as Record<string, unknown>)[field.key];
    if (typeof v === "string" && v.trim()) out[field.key] = v.trim().slice(0, MAX_TEXT_LENGTH);
  }
  return out;
}

/** Defaults with the overrides on top: what the pages render. */
export function resolveReviewPageTexts(raw: unknown): ReviewPageTexts {
  const overrides = parseReviewTextOverrides(raw);
  const out = {} as ReviewPageTexts;
  for (const field of REVIEW_TEXT_FIELDS) out[field.key] = overrides[field.key] ?? field.default;
  return out;
}

export async function getReviewPageTexts(): Promise<ReviewPageTexts> {
  const row = await db.orgSettings.findUnique({ where: { id: ORG_SETTINGS_ID }, select: { reviewPageTexts: true } });
  return resolveReviewPageTexts(row?.reviewPageTexts);
}

export async function getReviewTextOverrides(): Promise<Partial<ReviewPageTexts>> {
  const row = await db.orgSettings.findUnique({ where: { id: ORG_SETTINGS_ID }, select: { reviewPageTexts: true } });
  return parseReviewTextOverrides(row?.reviewPageTexts);
}

/** Replaces the whole override map: a key equal to its default, or
 * empty, is dropped so the editor's "texto original" stays the default
 * and keeps following future default changes. */
export async function saveReviewTextOverrides(input: Record<string, unknown>): Promise<Partial<ReviewPageTexts>> {
  const cleaned = parseReviewTextOverrides(input);
  for (const field of REVIEW_TEXT_FIELDS) {
    if (cleaned[field.key] === field.default) delete cleaned[field.key];
  }
  await db.orgSettings.upsert({
    where: { id: ORG_SETTINGS_ID },
    update: { reviewPageTexts: cleaned },
    create: { id: ORG_SETTINGS_ID, reviewPageTexts: cleaned },
  });
  return cleaned;
}

export interface ReviewTextVars {
  nombre?: string | null;
  evento?: string;
  premios?: string;
  fecha?: string;
}

/** "{{nombre}}" etc. → the real values. A missing first name drops the
 * ", {{nombre}}" / "{{nombre}}, " around it so "¡Gracias, !" never shows. */
export function fillReviewText(text: string, vars: ReviewTextVars): string {
  let out = text;
  const nombre = vars.nombre?.trim() ?? "";
  if (!nombre) out = out.replace(/,\s*\{\{nombre\}\}/g, "").replace(/\{\{nombre\}\},\s*/g, "").replace(/\s*\{\{nombre\}\}/g, "");
  else out = out.replace(/\{\{nombre\}\}/g, nombre);
  out = out.replace(/\{\{evento\}\}/g, vars.evento ?? "");
  out = out.replace(/\{\{premios\}\}/g, vars.premios ?? "");
  out = out.replace(/\{\{fecha\}\}/g, vars.fecha ?? "");
  return out.replace(/\s{2,}/g, " ").trim();
}
