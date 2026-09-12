import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { queueMetaEvent } from "@/lib/meta/capi";
import { hasActiveConsent } from "@/lib/consent";
import { issueQrToken } from "@/lib/ticket";
import { sendTicketEmail } from "@/lib/sendTicketEmail";
import { sendTicketLinkViaWhatsApp } from "@/lib/whatsapp/sendTicketLink";
import { registerParticipant } from "@/lib/zoom";
import type { Event, Person, Registration } from "@prisma/client";

/** Everything that has to happen the MOMENT a registration becomes real
 * (status -> CONFIRMED) — shared by /api/register's own free/immediate
 * path and lib/payments/confirmRegistrationPayment.ts's paid path, so the
 * two can never quietly drift apart (a paid confirmation getting the QR
 * email but not the Zoom link, say). Issues/reuses the QR token, best-
 * effort registers the person for Zoom when this event is VIRTUAL/HYBRID
 * with a meeting configured, sends the ticket email, attempts the
 * WhatsApp ticket link, and fires the Purchase CAPI event (gated by
 * ADVERTISING consent and by wasAlreadyConfirmed, same reasoning as
 * before this was factored out — a resend of an already-CONFIRMED
 * registration must never inflate the Purchase count Meta optimizes
 * against). */
export async function finalizeConfirmedRegistration(params: {
  person: Person;
  event: Event;
  registration: Registration;
  wasAlreadyConfirmed: boolean;
  purchaseEventId?: string;
  fbc?: string;
  fbp?: string;
  // Only ever available from the free/immediate-confirm path (it reads
  // the CUSTOMER's own request headers) — the paid path confirms from a
  // Wompi server-to-server webhook or this app's own redirect-return
  // page, neither of which carries the original browser's IP/UA, so both
  // leave these undefined rather than misattributing Wompi's own.
  clientIpAddress?: string;
  clientUserAgent?: string;
}): Promise<{ whatsappTicketLinkSent: boolean; qrToken: string; zoomJoinUrl?: string }> {
  const { person, event, registration, wasAlreadyConfirmed } = params;

  let qrToken = registration.qrToken;
  if (!qrToken) {
    qrToken = issueQrToken(registration.id);
    await db.registration.update({ where: { id: registration.id }, data: { qrToken } });
  }

  // Best-effort — a Zoom hiccup (misconfigured meeting id, expired app
  // credentials, Zoom's own API being down) must never block a paid
  // confirmation. Only for a genuinely virtual/hybrid event with a
  // meeting actually configured; every IN_PERSON event behaves exactly
  // as before this existed (zoomJoinUrl stays undefined, sendTicketEmail
  // renders no Zoom block at all).
  let zoomJoinUrl: string | undefined;
  if (event.format !== "IN_PERSON" && event.zoomMeetingId) {
    zoomJoinUrl =
      (await registerParticipant(event.zoomMeetingId, event.zoomIsWebinar, {
        email: person.email,
        firstName: person.firstName ?? "",
        lastName: person.lastName ?? "",
      }).catch((err) => {
        console.error("finalizeConfirmedRegistration: zoom registration failed", registration.id, err);
        return null;
      })) ?? undefined;
    // Persisted, not just handed to sendTicketEmail below — so a second
    // reader (the /[eventSlug]/pago return-page render, see that file's
    // own comment) can show this same personal link right away too,
    // instead of it only ever reaching the person via email/WhatsApp.
    if (zoomJoinUrl) {
      await db.registration.update({ where: { id: registration.id }, data: { zoomJoinUrl } });
    }
  }

  await sendTicketEmail({
    person,
    event,
    qrToken,
    registration: { id: registration.id, ticketTypeId: registration.ticketTypeId, ticketCount: registration.ticketCount },
    zoomJoinUrl,
  });

  const whatsappTicketLinkSent = await sendTicketLinkViaWhatsApp({ person, event, qrToken });

  if (!wasAlreadyConfirmed && (await hasActiveConsent(person.id, "ADVERTISING"))) {
    await queueMetaEvent({
      eventId: params.purchaseEventId ?? randomUUID(),
      eventName: "Purchase",
      eventSourceUrl: `${process.env.APP_BASE_URL ?? ""}/${event.slug}`,
      userData: {
        email: person.email,
        phone: person.phone ?? undefined,
        clientIpAddress: params.clientIpAddress,
        clientUserAgent: params.clientUserAgent,
        fbc: params.fbc,
        fbp: params.fbp,
      },
      customData: {
        value: Number(process.env.META_PURCHASE_PLACEHOLDER_VALUE || "1"),
        currency: process.env.DEFAULT_CURRENCY || "COP",
      },
      registrationId: registration.id,
    });
  }

  return { whatsappTicketLinkSent, qrToken, zoomJoinUrl };
}
