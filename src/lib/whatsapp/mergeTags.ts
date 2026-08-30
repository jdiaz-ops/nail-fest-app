import type { Event, Person } from "@prisma/client";
import { formatDateInTz } from "@/lib/dateFormat";

// The fixed set of merge tags a WhatsApp broadcast's variableMapping can
// reference — same idea as lib/confirmationTemplate.ts's
// CONFIRMATION_MERGE_TAGS, scoped down to what a WhatsApp template body
// variable actually needs (a short inline value, not a block of HTML like
// {{ENTRADAS}} — Meta templates don't support markup in body variables at
// all, so there's no QR/ticket tag here, just plain text fields).
export const WHATSAPP_MERGE_TAGS: { key: string; label: string }[] = [
  { key: "NOMBRE", label: "Nombre (primer nombre)" },
  { key: "NOMBRE_COMPLETO", label: "Nombre completo" },
  { key: "EVENTO_NOMBRE", label: "Nombre del evento" },
  { key: "EVENTO_FECHA_INICIO", label: "Fecha de inicio" },
  { key: "EVENTO_HORA_INICIO", label: "Hora de inicio" },
  { key: "EVENTO_LUGAR_NOMBRE", label: "Nombre del lugar" },
  { key: "CIUDAD", label: "Ciudad de la persona" },
];

export interface MergeTagContext {
  person: Pick<Person, "firstName" | "lastName" | "city">;
  event?: Pick<Event, "name" | "startsAt" | "venueName"> | null;
  timezone: string;
  language: string;
}

/** Resolves one merge tag key to its real value for one recipient — used
 * both to render the {{1}}, {{2}}, ... variables sent to Meta and to build
 * the composer's live preview. Falls back to an empty string for a tag
 * with nothing to substitute (e.g. EVENTO_* on a segment-scoped broadcast
 * with no single event) rather than throwing — a broadcast with an
 * event-less variable mapped is a composer-time mistake, not something
 * that should crash a send for everyone else in the batch. */
export function resolveMergeTag(key: string, ctx: MergeTagContext): string {
  switch (key) {
    case "NOMBRE":
      return ctx.person.firstName ?? "";
    case "NOMBRE_COMPLETO":
      return [ctx.person.firstName, ctx.person.lastName].filter(Boolean).join(" ");
    case "CIUDAD":
      return ctx.person.city ?? "";
    case "EVENTO_NOMBRE":
      return ctx.event?.name ?? "";
    case "EVENTO_FECHA_INICIO":
      return ctx.event
        ? formatDateInTz(ctx.event.startsAt, { day: "numeric", month: "long" }, ctx.timezone, ctx.language)
        : "";
    case "EVENTO_HORA_INICIO":
      return ctx.event
        ? formatDateInTz(ctx.event.startsAt, { hour: "numeric", minute: "2-digit" }, ctx.timezone, ctx.language)
        : "";
    case "EVENTO_LUGAR_NOMBRE":
      return ctx.event?.venueName ?? "";
    default:
      return "";
  }
}
