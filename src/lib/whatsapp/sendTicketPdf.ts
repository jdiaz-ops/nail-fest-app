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

/** Up to 5 most recent confirmed, QR-issued registrations for a person —
 * what the Bandeja sidebar lists to pick which ticket to resend. Same
 * cap/ordering as /api/resend-ticket's own query. */
export async function listResendableRegistrations(personId: string) {
  return db.registration.findMany({
    where: { personId, status: "CONFIRMED", qrToken: { not: null } },
    include: { event: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
