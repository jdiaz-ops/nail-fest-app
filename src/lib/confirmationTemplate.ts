import { formatDateInTz } from "@/lib/dateFormat";
import { htmlToPlainText } from "@/lib/email/templates";

// Merge tags for the confirmation-email editor (Confirmación del evento,
// /admin/events/[id]/confirmation and /admin/settings/confirmation) — the
// same idea as Ticket Tailor's own placeholder dropdown, scoped to real
// data this app actually has. Deliberately NOT offering postcode, "add to
// calendar" links, or seat reservations like Ticket Tailor's own list —
// this app has no postal-code field, no ICS generation, and no seating,
// so those would be placeholders with nothing real to substitute.
export const CONFIRMATION_MERGE_TAGS: { key: string; label: string }[] = [
  { key: "ENTRADAS", label: "Entradas (código QR)" },
  { key: "EVENTO_NOMBRE", label: "Nombre del evento" },
  { key: "EVENTO_FECHA_RANGO", label: "Fecha de inicio y fin" },
  { key: "EVENTO_FECHA_INICIO", label: "Fecha de inicio" },
  { key: "EVENTO_HORA_INICIO", label: "Hora de inicio" },
  { key: "EVENTO_FECHA_FIN", label: "Fecha de fin" },
  { key: "EVENTO_HORA_FIN", label: "Hora de fin" },
  { key: "EVENTO_LUGAR_NOMBRE", label: "Nombre del lugar" },
  { key: "EVENTO_LUGAR_DIRECCION", label: "Dirección del lugar" },
];

export interface ConfirmationTemplateData {
  firstName: string;
  lastName?: string;
  eventName: string;
  venueName?: string;
  venueAddress?: string;
  startsAt: Date;
  endsAt?: Date;
  qrImageUrl: string;
  ticketTypeName?: string;
  ticketCount?: number;
  confirmationCode: string;
  orgName: string;
  timezone: string;
  language: string;
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
// legible ticket, not a bare <img>.
function renderVoucherHtml(data: ConfirmationTemplateData): string {
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

/** The event/global override path — see OrgSettings.confirmationEmailHtml
 * and Event.confirmationEmailHtml's own schema comments for the fallback
 * chain this is one link in (sendTicketEmail.ts owns the actual chain
 * logic; this just renders ONE resolved template string). */
export function renderConfirmationFromTemplate(templateHtml: string, data: ConfirmationTemplateData): { subject: string; text: string; html: string } {
  const dateOpts = { dateStyle: "full" as const, timeStyle: "short" as const };
  const rangeWhen = [
    formatDateInTz(data.startsAt, dateOpts, data.timezone, data.language),
    data.endsAt ? ` – ${formatDateInTz(data.endsAt, dateOpts, data.timezone, data.language)}` : "",
  ].join("");

  const replacements: Record<string, string> = {
    ENTRADAS: renderVoucherHtml(data),
    EVENTO_NOMBRE: escapeHtml(data.eventName),
    EVENTO_FECHA_RANGO: escapeHtml(rangeWhen),
    EVENTO_FECHA_INICIO: escapeHtml(formatDateInTz(data.startsAt, { dateStyle: "full" }, data.timezone, data.language)),
    EVENTO_HORA_INICIO: escapeHtml(formatDateInTz(data.startsAt, { timeStyle: "short" }, data.timezone, data.language)),
    EVENTO_FECHA_FIN: data.endsAt ? escapeHtml(formatDateInTz(data.endsAt, { dateStyle: "full" }, data.timezone, data.language)) : "",
    EVENTO_HORA_FIN: data.endsAt ? escapeHtml(formatDateInTz(data.endsAt, { timeStyle: "short" }, data.timezone, data.language)) : "",
    EVENTO_LUGAR_NOMBRE: escapeHtml(data.venueName ?? ""),
    EVENTO_LUGAR_DIRECCION: escapeHtml(data.venueAddress ?? ""),
  };

  let body = templateHtml;
  for (const [key, value] of Object.entries(replacements)) {
    body = body.split(`{{${key}}}`).join(value);
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">${body}</div>`;
  const text = htmlToPlainText(body);
  const subject = `Tu entrada para ${data.eventName}`;
  return { subject, text, html };
}
