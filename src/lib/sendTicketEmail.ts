import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";
import { renderConfirmationFromTemplate } from "@/lib/confirmationTemplate";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { getOrgSettings } from "@/lib/settings";

// Shared by /api/register (first send + resend-on-resubmit), /api/resend-
// ticket (the self-serve "I lost my email" flow), and /api/admin/
// registrations/[id]/resend (an admin resending on someone's behalf) —
// one place that renders the QR, builds the email, sends it, and logs the
// attempt, so every call site stays identical instead of drifting apart.
export async function sendTicketEmail(params: {
  person: { id: string; email: string; firstName: string | null; lastName?: string | null };
  event: {
    name: string;
    city: string;
    startsAt: Date;
    endsAt?: Date | null;
    venueName?: string | null;
    venueAddress?: string | null;
    imageUrl?: string | null;
    // Per-event override of the confirmation template — see
    // Event.confirmationEmailHtml's own schema comment for the fallback
    // chain (this -> the account-wide template -> the hand-built
    // default). Optional so the type stays satisfied by any older/other
    // caller that doesn't have it; Prisma's own Event rows already carry
    // it since none of the existing call sites use a narrowing `select`.
    confirmationEmailHtml?: string | null;
  };
  qrToken: string;
  // Registration.id/ticketTypeId/ticketCount — optional so this keeps
  // working for any call site that only has the older
  // {person, event, qrToken} shape. ticketTypeId is resolved to the
  // TicketType's own name here (one lookup, one place) rather than
  // making every caller fetch and pass a name string.
  registration?: { id: string; ticketTypeId?: string | null; ticketCount?: number | null };
}): Promise<{ ok: boolean }> {
  try {
    const orgSettings = await getOrgSettings();
    // Real URL, not a base64 data: URI — see confirmationEmail's own
    // reasoning in the original /api/register comment: most inboxes drop
    // inline data: images.
    const qrImageUrl = `${process.env.APP_BASE_URL || ""}/api/ticket-qr/${params.qrToken}`;
    const ticketType = params.registration?.ticketTypeId
      ? await db.ticketType.findUnique({ where: { id: params.registration.ticketTypeId } })
      : null;
    // Last 8 chars of the cuid, uppercased — not cryptographically
    // meaningful, just a short human-readable reference (same idea as an
    // "order #") for someone reading it over the phone or WhatsApp.
    const confirmationCode = (params.registration?.id ?? params.qrToken).slice(-8).toUpperCase();

    // Fallback chain: this event's own override -> the account-wide
    // template -> the original hand-built design (confirmationEmail()),
    // exactly as before this feature existed. Whoever never opens
    // Confirmación del evento gets IDENTICAL behavior to before — this
    // whole branch is additive, not a rewrite of the default path.
    const customTemplate = params.event.confirmationEmailHtml ?? orgSettings.confirmationEmailHtml;
    const { subject, text, html } = customTemplate
      ? renderConfirmationFromTemplate(customTemplate, {
          firstName: params.person.firstName ?? "",
          lastName: params.person.lastName ?? undefined,
          eventName: params.event.name,
          venueName: params.event.venueName ?? undefined,
          venueAddress: params.event.venueAddress ?? undefined,
          startsAt: params.event.startsAt,
          endsAt: params.event.endsAt ?? undefined,
          qrImageUrl,
          ticketTypeName: ticketType?.name,
          ticketCount: params.registration?.ticketCount ?? undefined,
          confirmationCode,
          orgName: orgSettings.name,
          timezone: orgSettings.timezone,
          language: orgSettings.language,
        })
      : confirmationEmail({
          firstName: params.person.firstName ?? "",
          lastName: params.person.lastName ?? undefined,
          eventName: params.event.name,
          eventCity: params.event.city,
          venueName: params.event.venueName ?? undefined,
          venueAddress: params.event.venueAddress ?? undefined,
          startsAt: params.event.startsAt,
          endsAt: params.event.endsAt ?? undefined,
          qrImageUrl,
          eventImageUrl: params.event.imageUrl ?? undefined,
          ticketTypeName: ticketType?.name,
          ticketCount: params.registration?.ticketCount ?? undefined,
          confirmationCode,
          orgName: orgSettings.name,
          timezone: orgSettings.timezone,
          language: orgSettings.language,
        });
    // A real, self-contained ticket (event name/date/venue, attendee,
    // ticket type, the QR itself) instead of the old bare QR-only PNG — a
    // lone QR image, saved or printed on its own, carries no event or
    // attendee info once separated from the email body. Our previous
    // ticketing platform's own "Attach ticket vouchers as a PDF" checkbox (OrgSettings.
    // attachTicketPdf, /admin/settings/confirmation) decides whether this
    // gets built at all — off means no attachment, not a fallback to the
    // old bare-QR PNG.
    const pdfAttachment = orgSettings.attachTicketPdf
      ? await renderTicketPdfBuffer({
          firstName: params.person.firstName ?? "",
          lastName: params.person.lastName ?? undefined,
          eventName: params.event.name,
          venueName: params.event.venueName ?? undefined,
          venueAddress: params.event.venueAddress ?? undefined,
          startsAt: params.event.startsAt,
          endsAt: params.event.endsAt ?? undefined,
          ticketTypeName: ticketType?.name,
          ticketCount: params.registration?.ticketCount ?? undefined,
          confirmationCode,
          qrToken: params.qrToken,
          timezone: orgSettings.timezone,
          language: orgSettings.language,
        })
      : null;
    const sent = await emailProvider.sendTransactional({
      to: params.person.email,
      subject,
      text,
      html,
      attachments: pdfAttachment
        ? [{ filename: "entrada-nailfest.pdf", content: pdfAttachment, contentType: "application/pdf" }]
        : undefined,
    });
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: params.person.id,
        toEmail: params.person.email,
        providerMessageId: sent.providerMessageId,
        status: "SENT",
      },
    });
    return { ok: true };
  } catch (err) {
    // Never throw — the caller decides whether a failed send should fail
    // the whole request (it shouldn't, for a registration) or just report
    // "no lo pudimos enviar" (for a self-serve resend).
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: params.person.id,
        toEmail: params.person.email,
        status: "FAILED",
      },
    });
    console.error("sendTicketEmail failed", err);
    return { ok: false };
  }
}
