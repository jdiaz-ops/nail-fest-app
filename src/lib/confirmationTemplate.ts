import type { EventFormat } from "@prisma/client";
import { formatDateInTz } from "@/lib/dateFormat";
import { formatEventScheduleLines } from "@/lib/eventSchedule";
import { htmlToPlainText } from "@/lib/email/templates";

// Merge tags for the confirmation-email editor (Confirmación del evento,
// /admin/events/[id]/confirmation and /admin/settings/confirmation) — the
// same idea as our previous ticketing platform's own placeholder
// dropdown, scoped to real data this app actually has. Deliberately NOT
// offering postcode, "add to calendar" links, or seat reservations like
// that platform's own list —
// this app has no postal-code field, no ICS generation, and no seating,
// so those would be placeholders with nothing real to substitute.
//
// EVENTO_UBICACION_LINEA / EVENTO_ACCESO_VIRTUAL_BOTON / EVENTO_INSTRUCCION_ENTRADA
// exist so a custom template reads correctly for EVERY event format
// without the admin having to hand-write a conditional — each resolves
// to different text (or nothing at all) depending on Event.format, see
// renderConfirmationFromTemplate below. EVENTO_LUGAR_NOMBRE/DIRECCION are
// kept too (raw values, for an admin who wants to lay out venue info
// their own way), but the STARTER template uses the smart ones instead —
// see ConfirmationTemplateEditor.tsx's own STARTER_HTML.
export const CONFIRMATION_MERGE_TAGS: { key: string; label: string }[] = [
  { key: "ENTRADAS", label: "Entradas (código QR — vacío en eventos virtuales)" },
  { key: "EVENTO_NOMBRE", label: "Nombre del evento" },
  { key: "EVENTO_FORMATO", label: "Formato (Presencial/Virtual/Híbrido)" },
  { key: "EVENTO_FECHA_RANGO", label: "Fecha de inicio y fin" },
  { key: "EVENTO_FECHA_INICIO", label: "Fecha de inicio" },
  { key: "EVENTO_HORA_INICIO", label: "Hora de inicio" },
  { key: "EVENTO_FECHA_FIN", label: "Fecha de fin" },
  { key: "EVENTO_HORA_FIN", label: "Hora de fin" },
  { key: "EVENTO_UBICACION_LINEA", label: "Lugar (o acceso virtual, según el formato)" },
  { key: "EVENTO_ACCESO_VIRTUAL_BOTON", label: "Botón para unirse por Zoom (si aplica)" },
  { key: "EVENTO_INSTRUCCION_ENTRADA", label: "Instrucción de entrada (QR o Zoom, según el formato)" },
  { key: "EVENTO_LUGAR_NOMBRE", label: "Nombre del lugar (valor crudo)" },
  { key: "EVENTO_LUGAR_DIRECCION", label: "Dirección del lugar (valor crudo)" },
];

export interface ConfirmationTemplateData {
  firstName: string;
  lastName?: string;
  eventName: string;
  venueName?: string;
  venueAddress?: string;
  startsAt: Date;
  endsAt?: Date;
  /** Event.scheduleDays — see lib/eventSchedule.ts. Drives
   * {{EVENTO_FECHA_RANGO}} showing one line per real day instead of a
   * single combined range once an admin configures it. */
  scheduleDays?: unknown;
  qrImageUrl: string;
  ticketTypeName?: string;
  ticketCount?: number;
  confirmationCode: string;
  orgName: string;
  timezone: string;
  language: string;
  /** Event.format — defaults to IN_PERSON so any older caller that
   * doesn't pass this keeps getting exactly the old presencial copy. */
  format?: EventFormat;
  /** This registrant's own personal Zoom join link — see
   * lib/registrationConfirmation.ts. Only ever set for VIRTUAL/HYBRID
   * with Zoom configured AND the best-effort registration call having
   * actually succeeded. */
  zoomJoinUrl?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The one non-text substitution — a self-contained, already-styled block
// (the same visual language as the original hand-built ticket: teal
// header, dashed tear-line, QR centered) so an admin who inserts
// {{ENTRADAS}} into an otherwise plain-text template still gets a real,
// legible ticket, not a bare <img>. Empty for a pure VIRTUAL event — see
// this function's own reasoning in sendTicketEmail.ts's PDF-attachment
// comment, same logic applies here: there is no door to scan a QR at.
function renderVoucherHtml(data: ConfirmationTemplateData): string {
  if (data.format === "VIRTUAL") return "";
  const attendeeName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
  const ticketTypeLine =
    data.ticketTypeName && (data.ticketCount ?? 1) > 1 ? `${data.ticketTypeName} · x${data.ticketCount}` : data.ticketTypeName;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e3e1dc;border-radius:14px;overflow:hidden;margin:16px 0;">
      <tr>
        <td style="background:#00beb5;padding:12px 20px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#0b2e2c;opacity:.8;">Tu entrada</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px;text-align:center;">
          <img src="${escapeHtml(data.qrImageUrl)}" alt="Código QR de tu entrada" width="160" height="160" style="display:block;margin:0 auto 12px;" />
          ${attendeeName ? `<p style="margin:0;font-size:15px;font-weight:700;color:#17181c;">${escapeHtml(attendeeName)}</p>` : ""}
          ${
            ticketTypeLine
              ? `<p style="margin:6px 0 0;"><span style="display:inline-block;background:#f6f5f2;border:1px solid #e3e1dc;border-radius:999px;padding:3px 10px;font-size:11px;color:#5b5f6b;">${escapeHtml(ticketTypeLine)}</span></p>`
              : ""
          }
          <p style="margin:10px 0 0;font-size:11px;letter-spacing:.05em;color:#8a8478;">CÓDIGO ${escapeHtml(data.confirmationCode)}</p>
        </td>
      </tr>
    </table>
  `;
}

// One ready-to-use line covering "Lugar" for IN_PERSON/HYBRID and virtual
// access for VIRTUAL — the single tag STARTER_HTML uses instead of a
// hardcoded "Lugar: {{...}} — {{...}}" that used to render as a bare
// "Lugar: —" once both venue fields were empty (which is exactly what
// happens on a real VIRTUAL event, since it has no venue to fill in).
function renderUbicacionLinea(data: ConfirmationTemplateData): string {
  const venueLine = [data.venueName, data.venueAddress].filter(Boolean).join(" — ");
  const format = data.format ?? "IN_PERSON";
  if (format === "VIRTUAL") {
    return data.zoomJoinUrl ? "Acceso: virtual, por Zoom — tu link personal va más abajo." : "Acceso: virtual, por Zoom.";
  }
  if (format === "HYBRID") {
    return venueLine
      ? `Lugar: ${escapeHtml(venueLine)} — también puedes conectarte por Zoom, revisa el acceso más abajo.`
      : "También puedes conectarte por Zoom — revisa el acceso más abajo.";
  }
  return venueLine ? `Lugar: ${escapeHtml(venueLine)}` : "";
}

function renderAccesoVirtualBoton(data: ConfirmationTemplateData): string {
  if (!data.zoomJoinUrl) return "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;border-radius:10px;margin:12px 0;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8a8478;">Tu acceso por Zoom</p>
          <a href="${escapeHtml(data.zoomJoinUrl)}" style="display:inline-block;background:#00beb5;color:#0b2e2c;font-weight:700;font-size:14px;text-decoration:none;padding:10px 20px;border-radius:999px;">Unirme a la sesión</a>
          <p style="margin:8px 0 0;font-size:12px;color:#5b5f6b;">Este link es personal — no lo compartas, es solo tuyo.</p>
        </td>
      </tr>
    </table>
  `;
}

function renderInstruccionEntrada(data: ConfirmationTemplateData): string {
  const format = data.format ?? "IN_PERSON";
  if (format === "VIRTUAL") return "";
  return "Presenta el código QR de abajo en la entrada. Puedes reingresar las veces que necesites durante el evento.";
}

/** The event/global override path — see OrgSettings.confirmationEmailHtml
 * and Event.confirmationEmailHtml's own schema comments for the fallback
 * chain this is one link in (sendTicketEmail.ts owns the actual chain
 * logic; this just renders ONE resolved template string). */
export function renderConfirmationFromTemplate(templateHtml: string, data: ConfirmationTemplateData): { subject: string; text: string; html: string } {
  // One line per real day when Event.scheduleDays is set, joined with
  // <br> (not a plain "\n" — this substitutes into HTML, and
  // htmlToPlainText below turns <br> back into a real line break for
  // the plain-text version) — otherwise the same single combined range
  // as before. See eventSchedule.ts's own comment on why.
  const whenLines = formatEventScheduleLines(
    { startsAt: data.startsAt, endsAt: data.endsAt ?? null, scheduleDays: data.scheduleDays },
    data.timezone,
    data.language
  );
  const rangeWhenHtml = whenLines.map(escapeHtml).join("<br>");

  // Self-healing upgrade for a template saved before EVENTO_UBICACION_LINEA/
  // EVENTO_INSTRUCCION_ENTRADA existed: both the account-wide default and
  // every event override started from the exact same STARTER_HTML text
  // (ConfirmationTemplateEditor.tsx), so any row still carrying that
  // literal, untouched "Lugar: ... — ..." / "Presenta el código QR..."
  // wording gets swapped for the new smart tags right here, at render
  // time — no DB migration needed, and a template an admin genuinely
  // customized (different wording) is untouched, since the match has to
  // be exact.
  let body = templateHtml
    .split("Lugar: {{EVENTO_LUGAR_NOMBRE}} — {{EVENTO_LUGAR_DIRECCION}}")
    .join("{{EVENTO_UBICACION_LINEA}}")
    .split("Presenta el código QR de abajo en la entrada. Puedes reingresar las veces que necesites durante el evento.")
    .join("{{EVENTO_INSTRUCCION_ENTRADA}}");

  const replacements: Record<string, string> = {
    ENTRADAS: renderVoucherHtml(data),
    EVENTO_NOMBRE: escapeHtml(data.eventName),
    EVENTO_FORMATO: data.format === "VIRTUAL" ? "Virtual" : data.format === "HYBRID" ? "Híbrido" : "Presencial",
    EVENTO_FECHA_RANGO: rangeWhenHtml,
    EVENTO_FECHA_INICIO: escapeHtml(formatDateInTz(data.startsAt, { dateStyle: "full" }, data.timezone, data.language)),
    EVENTO_HORA_INICIO: escapeHtml(formatDateInTz(data.startsAt, { timeStyle: "short" }, data.timezone, data.language)),
    EVENTO_FECHA_FIN: data.endsAt ? escapeHtml(formatDateInTz(data.endsAt, { dateStyle: "full" }, data.timezone, data.language)) : "",
    EVENTO_HORA_FIN: data.endsAt ? escapeHtml(formatDateInTz(data.endsAt, { timeStyle: "short" }, data.timezone, data.language)) : "",
    EVENTO_UBICACION_LINEA: renderUbicacionLinea(data),
    EVENTO_ACCESO_VIRTUAL_BOTON: renderAccesoVirtualBoton(data),
    EVENTO_INSTRUCCION_ENTRADA: renderInstruccionEntrada(data),
    EVENTO_LUGAR_NOMBRE: escapeHtml(data.venueName ?? ""),
    EVENTO_LUGAR_DIRECCION: escapeHtml(data.venueAddress ?? ""),
  };

  for (const [key, value] of Object.entries(replacements)) {
    body = body.split(`{{${key}}}`).join(value);
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">${body}</div>`;
  const text = htmlToPlainText(body);
  const subject = `Tu entrada para ${data.eventName}`;
  return { subject, text, html };
}

/** The subject line's own tiny merge-tag substitution — deliberately NOT
 * the same `replacements` map renderConfirmationFromTemplate builds for
 * the body: those values are HTML-escaped (right for dropping into
 * markup, wrong for a plain-text subject — "&amp;" would show up
 * literally in an inbox's subject list). A subject only needs a handful
 * of short, plain fields, so this substitutes straight from the raw
 * data instead of sharing that map. Used for BOTH the custom-template
 * subject override and the hardcoded default's subject (see
 * sendTicketEmail.ts, which always calls this rather than trusting the
 * `subject` either render function above returns) — so "Tu entrada para
 * {{EVENTO_NOMBRE}}" and an admin's own subject text go through the
 * exact same substitution logic. */
export function renderSubjectFromTemplate(
  subjectTemplate: string,
  data: Pick<ConfirmationTemplateData, "eventName" | "startsAt" | "endsAt" | "scheduleDays" | "timezone" | "language" | "format">
): string {
  const whenLines = formatEventScheduleLines(
    { startsAt: data.startsAt, endsAt: data.endsAt ?? null, scheduleDays: data.scheduleDays },
    data.timezone,
    data.language
  );
  const formatLabel = data.format === "VIRTUAL" ? "Virtual" : data.format === "HYBRID" ? "Híbrido" : "Presencial";
  return subjectTemplate
    .split("{{EVENTO_NOMBRE}}")
    .join(data.eventName)
    .split("{{EVENTO_FECHA_RANGO}}")
    .join(whenLines.join(" / "))
    .split("{{EVENTO_FORMATO}}")
    .join(formatLabel);
}
