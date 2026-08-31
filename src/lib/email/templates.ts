import { formatDateInTz } from "@/lib/dateFormat";

// Colors match the app's own brand tokens (src/app/globals.css: --ink,
// --ink-muted, --border, --accent, --accent-ink) — the ticket should look
// like it came from the same product as the registration page, not a
// generic mailer. ACCENT_INK is dark, not white: white text on this teal
// only hits ~2.3:1 contrast (fails WCAG AA), the dark ink hits ~8:1.
const INK = "#17181c";
const INK_MUTED = "#5b5f6b";
const BORDER = "#e3e1dc";
const ACCENT = "#00beb5";
const ACCENT_INK = "#0b2e2c";
const PAPER = "#f6f5f2";

export function confirmationEmail(params: {
  firstName: string;
  lastName?: string;
  eventName: string;
  eventCity: string;
  /** Event.venueName/.venueAddress — kept as two separate fields (not
   * pre-joined into one string) so each can sit on its own line: a long
   * address squeezed into one run-on line next to the date, or crammed
   * into a narrow half-width column, reads as clutter and wraps badly. */
  venueName?: string;
  venueAddress?: string;
  startsAt: Date;
  /** Event.endsAt — Nail Fest events routinely run Saturday→Sunday, so
   * when this is set the ticket shows BOTH dates as a range, same as the
   * public event page's own eventWhen (see [eventSlug]/page.tsx). Without
   * this, a two-day event's ticket only showed the Saturday date, which
   * reads as "this code only works for one day" — it doesn't, entry is
   * valid the whole event, this was just a display gap. */
  endsAt?: Date;
  qrImageUrl: string;
  /** Event.imageUrl (Vercel Blob) — a real https URL, so it renders in
   * inboxes the same way the QR does. Omitted from the ticket card when
   * the organizer hasn't uploaded one, same as the public event page. */
  eventImageUrl?: string;
  /** TicketType.name for this registration — undefined for older/seeded
   * events with no TicketType rows, in which case the ticket card just
   * omits the type row instead of showing a blank one. */
  ticketTypeName?: string;
  /** Registration.ticketCount — only shown alongside ticketTypeName when
   * more than 1 (a single ticket doesn't need a "x1" on it). */
  ticketCount?: number;
  /** Short, human-typeable reference for this registration (derived from
   * Registration.id — see sendTicketEmail.ts) — the "order number" you'd
   * read over the phone if someone calls asking about their entrada. */
  confirmationCode: string;
  /** OrgSettings.name (see /admin/settings/basic) — falls back to "Nail Fest". */
  orgName?: string;
  /** OrgSettings.timezone/.language — fall back to Colombia/Spanish, same as before these existed. */
  timezone?: string;
  language?: string;
}): { subject: string; text: string; html: string } {
  const orgName = params.orgName || "Nail Fest";
  const tz = params.timezone || "America/Bogota";
  const lang = params.language || "es";
  const dateOpts = { dateStyle: "full" as const, timeStyle: "short" as const };
  // Same range logic as [eventSlug]/page.tsx's own eventWhen — always show
  // both ends when endsAt is set, so a Sat→Sun event never reads as
  // single-day only. Kept in sync deliberately rather than importing one
  // from the other: the page builds a JSX-ready string, this builds a
  // plain one embedded in both an HTML table cell and a text email.
  const when = [
    formatDateInTz(params.startsAt, dateOpts, tz, lang),
    params.endsAt ? ` – ${formatDateInTz(params.endsAt, dateOpts, tz, lang)}` : "",
  ].join("");
  const attendeeName = [params.firstName, params.lastName].filter(Boolean).join(" ").trim();
  const ticketTypeLine =
    params.ticketTypeName && (params.ticketCount ?? 1) > 1
      ? `${params.ticketTypeName} · x${params.ticketCount}`
      : params.ticketTypeName;
  const venueLine = [params.venueName, params.venueAddress].filter(Boolean).join(" — ") || undefined;

  const subject = `Tu entrada para ${params.eventName}`;
  const text = [
    `Hola ${params.firstName},`,
    ``,
    `Tu registro para ${params.eventName} (${params.eventCity}) quedó confirmado.`,
    `Fecha: ${when}`,
    ...(venueLine ? [`Lugar: ${venueLine}`] : []),
    ...(attendeeName ? [`A nombre de: ${attendeeName}`] : []),
    ...(ticketTypeLine ? [`Entrada: ${ticketTypeLine}`] : []),
    `Código de confirmación: ${params.confirmationCode}`,
    ``,
    `Presenta el código QR adjunto en este correo (o una captura de pantalla) en la entrada. Puedes reingresar las veces que necesites durante el evento con el mismo código.`,
    ``,
    `Nos vemos ahí — ${orgName}`,
  ].join("\n");

  // Table-based layout with inline styles throughout — the only markup
  // that survives Gmail's and Outlook's stripped-down HTML rendering.
  // No rounded "ticket stub" notches: those need absolute positioning
  // that Outlook's Word rendering engine just drops, so instead of a
  // decoration that half-breaks depending on the inbox, the tear-line is
  // a plain dashed rule — same ticket idea, renders identically everywhere.
  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
            <tr>
              <td style="padding:0 8px 16px;">
                <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${INK};">¡Listo, ${escapeHtml(params.firstName)}!</p>
                <p style="margin:0;font-size:14px;color:${INK_MUTED};">Tu entrada para <strong>${escapeHtml(params.eventName)}</strong> quedó confirmada. Preséntala en la entrada — puedes reingresar las veces que necesites con el mismo código.</p>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
                  ${
                    params.eventImageUrl
                      ? `<tr><td><img src="${escapeHtml(params.eventImageUrl)}" alt="" width="480" style="display:block;width:100%;max-height:200px;object-fit:cover;" /></td></tr>`
                      : ""
                  }
                  <tr>
                    <td style="background:${ACCENT};padding:16px 24px;">
                      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT_INK};opacity:.7;">${escapeHtml(orgName)}</p>
                      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${ACCENT_INK};">${escapeHtml(params.eventName)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 0;">
                      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8a8478;">Fecha</p>
                      <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${INK};">${escapeHtml(when)}</p>
                    </td>
                  </tr>
                  ${
                    venueLine
                      ? `<tr>
                          <td style="padding:14px 24px 0;">
                            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8a8478;">Lugar</p>
                            ${params.venueName ? `<p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${INK};">${escapeHtml(params.venueName)}</p>` : ""}
                            ${params.venueAddress ? `<p style="margin:2px 0 0;font-size:13px;color:${INK_MUTED};">${escapeHtml(params.venueAddress)}</p>` : ""}
                          </td>
                        </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:20px 24px 0;">
                      <div style="border-top:2px dashed ${BORDER};"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 24px;text-align:center;">
                      <img src="${escapeHtml(params.qrImageUrl)}" alt="Código QR de tu entrada" width="180" height="180" style="display:block;margin:0 auto 16px;" />
                      ${attendeeName ? `<p style="margin:0;font-size:16px;font-weight:700;color:${INK};">${escapeHtml(attendeeName)}</p>` : ""}
                      ${
                        ticketTypeLine
                          ? `<p style="margin:8px 0 0;"><span style="display:inline-block;background:${PAPER};border:1px solid ${BORDER};border-radius:999px;padding:4px 12px;font-size:12px;color:${INK_MUTED};">${escapeHtml(ticketTypeLine)}</span></p>`
                          : ""
                      }
                      <p style="margin:12px 0 0;font-size:11px;letter-spacing:.05em;color:#8a8478;">CÓDIGO ${escapeHtml(params.confirmationCode)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 8px 0;text-align:center;">
                <p style="margin:0;font-size:12px;color:#8a8478;">${escapeHtml(orgName)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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

// The event-scoped broadcast composer (EventBroadcastComposer.tsx) uses
// the same TipTap rich-text editor as the event description and
// confirmation email, not a plain textarea — so its content arrives here
// as real (sanitized before storage — see EmailBroadcast.bodyHtml's own
// schema comment) HTML to embed directly, not plain text to escape and
// line-break.
//
// unsubscribeUrl is optional and, as of the LOGISTICS/TRANSACTIONAL
// change in lib/broadcasts.ts, never actually passed by that call site
// any more: an event-scoped broadcast is operational communication tied
// to the person's own registration (LOGISTICS consent — required to
// register at all, see lib/consent.ts's REQUIRED_CONSENTS), not a
// marketing send, so there's no real "unsubscribe" action to offer —
// showing a "darme de baja" link that silently does nothing (it only
// ever revoked MARKETING consent, see /api/unsubscribe) would be a
// broken promise. Kept optional rather than dropped outright in case a
// future caller genuinely needs the marketing-consent footer back.
export function broadcastEmailHtml(params: {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl?: string;
}): { subject: string; text: string; html: string } {
  const footer = params.unsubscribeUrl
    ? `Recibiste este correo porque diste tu consentimiento de marketing al registrarte en un evento de Nail Fest. <a href="${params.unsubscribeUrl}">Darme de baja</a>`
    : `Recibiste este correo porque estás registrada/o en un evento de Nail Fest.`;
  const text = `${htmlToPlainText(params.bodyHtml)}${params.unsubscribeUrl ? `\n\n---\nDarse de baja de estos correos: ${params.unsubscribeUrl}` : ""}`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color:#1a1a1a;">
      ${params.bodyHtml}
      <hr style="border:none;border-top:1px solid #ddd; margin: 24px 0;" />
      <p style="color:#888; font-size: 12px;">${footer}</p>
    </div>
  `;
  return { subject: params.subject, text, html };
}

// A rough, good-enough plain-text fallback for the multipart email's text
// part — not meant to preserve rich formatting, just to give inboxes that
// prefer text/plain (or strip HTML entirely) something readable instead
// of raw markup.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(p|div|h[1-6]|li|br)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
