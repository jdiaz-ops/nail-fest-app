import { db } from "@/lib/db";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { buildTicketPdfDataForRegistration } from "@/lib/ticketPdf";

/** The Bandeja "Reenviar PDF por WhatsApp" action — the same real
 * problem WhatChimp never solved: someone writes in saying the
 * confirmation email never arrived (spam filter, typo'd address, they
 * just can't find it), and the fix used to always be "go re-send the
 * email and hope." This sends the same ticket PDF (event, attendee, QR)
 * straight into the WhatsApp thread instead — no separate inbox to miss.
 *
 * Sent by `link` (see WhatsAppDocumentMessage's own comment): Meta
 * fetches /api/ticket-pdf/[token] itself, so this never touches the PDF
 * bytes directly. Same 24h freeform-window rule as a text reply — a
 * document send outside that window would need an approved MEDIA
 * template, which this app doesn't build (see docs/WHATSAPP_SETUP.md,
 * "Not built") — so the caller (the API route) is expected to have
 * already checked the window before calling this. */
export async function sendTicketPdfViaWhatsApp(
  registrationId: string,
  phone: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await buildTicketPdfDataForRegistration(registrationId);
  if (!data) return { ok: false, error: "ticket_not_found" };

  const link = `${process.env.APP_BASE_URL || ""}/api/ticket-pdf/${data.qrToken}`;
  const caption = `🎟️ Tu entrada para ${data.eventName} — código ${data.confirmationCode}`;

  try {
    const result = await whatsappProvider.sendDocument({
      to: phone,
      link,
      filename: "entrada-nailfest.pdf",
      caption,
    });
    await recordOutboundMessage({
      phone,
      kind: "FREEFORM",
      body: caption,
      providerMessageId: result.providerMessageId,
      status: "SENT",
    });
    return { ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordOutboundMessage({
      phone,
      kind: "FREEFORM",
      body: caption,
      status: "FAILED",
      errorMessage,
    });
    console.error("whatsapp send-ticket-pdf failed", registrationId, err);
    return { ok: false, error: errorMessage };
  }
}

// Last 10 digits — the same matching rule inbox.ts's findPersonByPhone
// uses to tie a chat to a contact in the first place.
function phoneTail(phone: string | null | undefined): string | null {
  const tail = (phone ?? "").replace(/[^\d]/g, "").slice(-10);
  return tail.length >= 7 ? tail : null;
}

interface ChatRef {
  personId: string | null;
  phone: string;
}

/** Whether a registration's ticket may be sent into this chat: it belongs
 * to the chat's linked contact, or to any contact registered with this
 * same phone number. The second case is real — one phone can sit on more
 * than one contact (someone re-registering with another email creates a
 * second Person), while the chat stays linked to whichever it matched
 * first. Either way the ticket only ever goes to the phone its own
 * registration was made with, never to a stranger's. */
export function registrationBelongsToChat(registration: { personId: string; person: { phone: string | null } }, chat: ChatRef): boolean {
  if (chat.personId && registration.personId === chat.personId) return true;
  const tail = phoneTail(chat.phone);
  return tail !== null && phoneTail(registration.person.phone) === tail;
}

/** Up to 5 most recent confirmed, QR-issued registrations this chat can
 * resend — its linked contact's, plus any other contact's registered with
 * the same phone (see registrationBelongsToChat). What the Bandeja sidebar
 * lists to pick which ticket to resend. Same cap/ordering as
 * /api/resend-ticket's own query. */
export async function listResendableRegistrations(chat: ChatRef) {
  const tail = phoneTail(chat.phone);
  const owners = [...(chat.personId ? [{ personId: chat.personId }] : []), ...(tail ? [{ person: { phone: { endsWith: tail } } }] : [])];
  if (owners.length === 0) return [];
  return db.registration.findMany({
    where: { status: "CONFIRMED", qrToken: { not: null }, OR: owners },
    include: { event: true, person: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
