import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";
import { renderQrPngBuffer } from "@/lib/ticket";
import { getOrgSettings } from "@/lib/settings";

// Shared by /api/register (first send + resend-on-resubmit) and
// /api/resend-ticket (the self-serve "I lost my email" flow) — one place
// that renders the QR, builds the email, sends it, and logs the attempt,
// so both call sites stay identical instead of drifting apart.
export async function sendTicketEmail(params: {
  person: { id: string; email: string; firstName: string | null; lastName?: string | null };
  event: {
    name: string;
    city: string;
    startsAt: Date;
    venueName?: string | null;
    venueAddress?: string | null;
    imageUrl?: string | null;
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
    const venue = [params.event.venueName, params.event.venueAddress].filter(Boolean).join(" — ") || undefined;
    const ticketType = params.registration?.ticketTypeId
      ? await db.ticketType.findUnique({ where: { id: params.registration.ticketTypeId } })
      : null;
    // Last 8 chars of the cuid, uppercased — not cryptographically
    // meaningful, just a short human-readable reference (Ticket Tailor's
    // own "order #") for someone reading it over the phone or WhatsApp.
    const confirmationCode = (params.registration?.id ?? params.qrToken).slice(-8).toUpperCase();
    const { subject, text, html } = confirmationEmail({
      firstName: params.person.firstName ?? "",
      lastName: params.person.lastName ?? undefined,
      eventName: params.event.name,
      eventCity: params.event.city,
      venue,
      startsAt: params.event.startsAt,
      qrImageUrl,
      eventImageUrl: params.event.imageUrl ?? undefined,
      ticketTypeName: ticketType?.name,
      ticketCount: params.registration?.ticketCount ?? undefined,
      confirmationCode,
      orgName: orgSettings.name,
      timezone: orgSettings.timezone,
      language: orgSettings.language,
    });
    const qrAttachment = await renderQrPngBuffer(params.qrToken);
    const sent = await emailProvider.sendTransactional({
      to: params.person.email,
      subject,
      text,
      html,
      attachments: [{ filename: "entrada-nailfest.png", content: qrAttachment, contentType: "image/png" }],
    });
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: params.person.id,
        toEmail: params.person.email,
        sesMessageId: sent.providerMessageId,
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
