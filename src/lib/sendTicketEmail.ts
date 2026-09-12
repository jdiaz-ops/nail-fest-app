import { db } from "@/lib/db";
import type { EventFormat } from "@prisma/client";
import { emailProvider } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";
import { renderConfirmationFromTemplate, renderSubjectFromTemplate } from "@/lib/confirmationTemplate";
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
    // Event.scheduleDays — see lib/eventSchedule.ts. Optional so any
    // older/other caller without it still satisfies the type; falls
    // back to the plain startsAt–endsAt range exactly as before.
    scheduleDays?: unknown;
    venueName?: string | null;
    venueAddress?: string | null;
    imageUrl?: string | null;
    // Drives whether this email reads as "preséntate en la entrada" vs.
    // "únete por Zoom" (see confirmationEmail's/renderConfirmationFromTemplate's
    // own comments) — optional, defaulting to IN_PERSON, so any older/other
    // caller without it keeps behaving exactly as before this existed.
    format?: EventFormat;
    // Per-event override of the confirmation template — see
    // Event.confirmationEmailHtml's own schema comment for the fallback
    // chain (this -> the account-wide template -> the hand-built
    // default). Optional so the type stays satisfied by any older/other
    // caller that doesn't have it; Prisma's own Event rows already carry
    // it since none of the existing call sites use a narrowing `select`.
    confirmationEmailHtml?: string | null;
    // Same fallback chain as confirmationEmailHtml, for the subject line
    // — see Event.confirmationEmailSubject's own schema comment. Was
    // never actually configurable before this existed (hardcoded to "Tu
    // entrada para <evento>" in both render functions below); optional
    // here for the exact same "any older/other caller" reason as the
    // sibling field above.
    confirmationEmailSubject?: string | null;
  };
  qrToken: string;
  // Registration.id/ticketTypeId/ticketCount — optional so this keeps
  // working for any call site that only has the older
  // {person, event, qrToken} shape. ticketTypeId is resolved to the
  // TicketType's own name here (one lookup, one place) rather than
  // making every caller fetch and pass a name string.
  registration?: { id: string; ticketTypeId?: string | null; ticketCount?: number | null };
  // This registrant's own personal Zoom join link — see
  // lib/registrationConfirmation.ts, the only real caller that ever sets
  // this (a VIRTUAL/HYBRID event with Zoom configured). Undefined for
  // every other event, unchanged from before this existed.
  zoomJoinUrl?: string;
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
    const format = params.event.format ?? "IN_PERSON";
    const customTemplate = params.event.confirmationEmailHtml ?? orgSettings.confirmationEmailHtml;
    const { text, html } = customTemplate
      ? renderConfirmationFromTemplate(customTemplate, {
          firstName: params.person.firstName ?? "",
          lastName: params.person.lastName ?? undefined,
          eventName: params.event.name,
          venueName: params.event.venueName ?? undefined,
          venueAddress: params.event.venueAddress ?? undefined,
          startsAt: params.event.startsAt,
          endsAt: params.event.endsAt ?? undefined,
          scheduleDays: params.event.scheduleDays,
          qrImageUrl,
          ticketTypeName: ticketType?.name,
          ticketCount: params.registration?.ticketCount ?? undefined,
          confirmationCode,
          orgName: orgSettings.name,
          timezone: orgSettings.timezone,
          language: orgSettings.language,
          format,
          zoomJoinUrl: params.zoomJoinUrl,
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
          scheduleDays: params.event.scheduleDays,
          qrImageUrl,
          eventImageUrl: params.event.imageUrl ?? undefined,
          ticketTypeName: ticketType?.name,
          ticketCount: params.registration?.ticketCount ?? undefined,
          confirmationCode,
          orgName: orgSettings.name,
          timezone: orgSettings.timezone,
          language: orgSettings.language,
          format,
          zoomJoinUrl: params.zoomJoinUrl,
        });

    // Same fallback chain as the body, computed independently of which
    // body path ran above — an admin can set a custom subject without
    // touching the body HTML at all (and vice versa). Ignores whatever
    // `subject` the two render calls above returned; those only exist so
    // each function stays independently testable/callable.
    const subjectTemplate = params.event.confirmationEmailSubject ?? orgSettings.confirmationEmailSubject ?? "Tu entrada para {{EVENTO_NOMBRE}}";
    const subject = renderSubjectFromTemplate(subjectTemplate, {
      eventName: params.event.name,
      startsAt: params.event.startsAt,
      endsAt: params.event.endsAt ?? undefined,
      scheduleDays: params.event.scheduleDays,
      timezone: orgSettings.timezone,
      language: orgSettings.language,
      format,
    });

    // A real, self-contained ticket (event name/date/venue, attendee,
    // ticket type, the QR itself) instead of the old bare QR-only PNG — a
    // lone QR image, saved or printed on its own, carries no event or
    // attendee info once separated from the email body. Our previous
    // ticketing platform's own "Attach ticket vouchers as a PDF" checkbox (OrgSettings.
    // attachTicketPdf, /admin/settings/confirmation) decides whether this
    // gets built at all — off means no attachment, not a fallback to the
    // old bare-QR PNG. Never for a pure VIRTUAL event, org setting or
    // not: this PDF's entire content is "here's your QR, present it at
    // the door" — there is no door, so attaching it would just confuse a
    // virtual-only attendee. HYBRID still gets it (some attendees really
    // do walk in).
    const pdfAttachment = orgSettings.attachTicketPdf && format !== "VIRTUAL"
      ? await renderTicketPdfBuffer({
          firstName: params.person.firstName ?? "",
          lastName: params.person.lastName ?? undefined,
          eventName: params.event.name,
          venueName: params.event.venueName ?? undefined,
          venueAddress: params.event.venueAddress ?? undefined,
          startsAt: params.event.startsAt,
          endsAt: params.event.endsAt ?? undefined,
          scheduleDays: params.event.scheduleDays,
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
