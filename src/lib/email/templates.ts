import { formatDateInTz } from "@/lib/dateFormat";

export function confirmationEmail(params: {
  firstName: string;
  eventName: string;
  eventCity: string;
  startsAt: Date;
  qrImageUrl: string;
  /** OrgSettings.name (see /admin/settings/basic) — falls back to "Nail Fest". */
  orgName?: string;
  /** OrgSettings.timezone/.language — fall back to Colombia/Spanish, same as before these existed. */
  timezone?: string;
  language?: string;
}): { subject: string; text: string; html: string } {
  const orgName = params.orgName || "Nail Fest";
  const when = formatDateInTz(
    params.startsAt,
    { dateStyle: "full", timeStyle: "short" },
    params.timezone || "America/Bogota",
    params.language || "es"
  );
  const subject = `Tu entrada para ${params.eventName}`;
  const text = [
    `Hola ${params.firstName},`,
    ``,
    `Tu registro para ${params.eventName} (${params.eventCity}) quedó confirmado.`,
    `Fecha: ${when}`,
    ``,
    `Presenta el código QR adjunto en este correo (o una captura de pantalla) en la entrada. Puedes reingresar las veces que necesites durante el evento con el mismo código.`,
    ``,
    `Nos vemos ahí — ${orgName}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color:#1a1a1a;">
      <h1 style="font-size: 20px;">¡Listo, ${escapeHtml(params.firstName)}!</h1>
      <p>Tu registro para <strong>${escapeHtml(params.eventName)}</strong> (${escapeHtml(
        params.eventCity
      )}) quedó confirmado.</p>
      <p><strong>Fecha:</strong> ${escapeHtml(when)}</p>
      <p>Presenta este código QR en la entrada. Es válido para todo el evento — puedes reingresar las veces que necesites con el mismo código.</p>
      <img src="${params.qrImageUrl}" alt="Código QR de tu entrada" width="240" height="240" style="display:block;margin:16px 0;" />
      <p style="color:#666; font-size: 13px;">${escapeHtml(orgName)}</p>
    </div>
  `;

  return { subject, text, html };
}

export function broadcastEmail(params: {
  firstName: string;
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const text = `${params.bodyText}\n\n---\nDarse de baja de estos correos: ${params.unsubscribeUrl}`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color:#1a1a1a;">
      <p>${escapeHtml(params.bodyText).replace(/\n/g, "<br/>")}</p>
      <hr style="border:none;border-top:1px solid #ddd; margin: 24px 0;" />
      <p style="color:#888; font-size: 12px;">
        Recibiste este correo porque diste tu consentimiento de marketing al registrarte en un evento de Nail Fest.
        <a href="${params.unsubscribeUrl}">Darme de baja</a>
      </p>
    </div>
  `;
  return { subject: params.subject, text, html };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
