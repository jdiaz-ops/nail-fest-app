import type { Event, Person } from "@prisma/client";
import { formatDateInTz } from "@/lib/dateFormat";
import { formatEventScheduleLines } from "@/lib/eventSchedule";

// The fixed set of merge tags a WhatsApp broadcast's (or automation's —
// see WhatsAppAutomation.variableMapping) variableMapping can reference —
// same idea as lib/confirmationTemplate.ts's CONFIRMATION_MERGE_TAGS,
// scoped down to what a WhatsApp template body variable actually needs (a
// short inline value, not a block of HTML like {{ENTRADAS}} — Meta
// templates don't support markup in body variables at all, so there's no
// QR/ticket tag here, just plain text fields).
export const WHATSAPP_MERGE_TAGS: { key: string; label: string }[] = [
  { key: "NOMBRE", label: "Nombre (primer nombre)" },
  { key: "NOMBRE_COMPLETO", label: "Nombre completo" },
  { key: "EVENTO_NOMBRE", label: "Nombre del evento" },
  { key: "EVENTO_FECHA_INICIO", label: "Fecha de inicio" },
  { key: "EVENTO_FECHA_RANGO", label: "Fecha (rango completo, si el evento dura más de un día)" },
  { key: "EVENTO_HORA_INICIO", label: "Hora de inicio" },
  { key: "EVENTO_LUGAR_NOMBRE", label: "Nombre del lugar" },
  { key: "EVENTO_UBICACION_LINEA", label: "Modalidad (Lugar, o acceso virtual según el formato)" },
  { key: "CIUDAD", label: "Ciudad de la persona" },
  // Only ever real for the ZOOM_ACCESS_REMINDER trigger (see
  // lib/registrationConfirmation.ts / /api/zoom/send-access-reminder) —
  // resolves empty everywhere else, same "nothing to substitute" posture
  // as every other tag here.
  { key: "ZOOM_LINK", label: "Link personal de Zoom (solo disponible en el recordatorio antes del evento)" },
];

export interface MergeTagContext {
  person: Pick<Person, "firstName" | "lastName" | "city">;
  event?: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays"> | null;
  timezone: string;
  language: string;
  /** This registrant's own personal Zoom join link — see
   * lib/registrationConfirmation.ts. Only ever set by the
   * ZOOM_ACCESS_REMINDER send path; every other caller (broadcasts,
   * REGISTRATION_CONFIRMED) leaves this undefined, same as before this
   * tag existed. */
  zoomJoinUrl?: string;
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
    case "EVENTO_FECHA_RANGO":
      return ctx.event
        ? formatEventScheduleLines(
            { startsAt: ctx.event.startsAt, endsAt: ctx.event.endsAt ?? null, scheduleDays: ctx.event.scheduleDays },
            ctx.timezone,
            ctx.language
          ).join(" / ")
        : "";
    case "EVENTO_HORA_INICIO":
      return ctx.event
        ? formatDateInTz(ctx.event.startsAt, { hour: "numeric", minute: "2-digit" }, ctx.timezone, ctx.language)
        : "";
    case "EVENTO_LUGAR_NOMBRE":
      return ctx.event?.venueName ?? "";
    case "EVENTO_UBICACION_LINEA": {
      if (!ctx.event) return "";
      const venueLine = [ctx.event.venueName, ctx.event.venueAddress].filter(Boolean).join(" — ");
      if (ctx.event.format === "VIRTUAL") return "Virtual, por Zoom";
      if (ctx.event.format === "HYBRID") return venueLine ? `${venueLine} (también por Zoom)` : "Presencial y por Zoom";
      return venueLine || "Presencial";
    }
    case "ZOOM_LINK":
      return ctx.zoomJoinUrl ?? "";
    default:
      return "";
  }
}
