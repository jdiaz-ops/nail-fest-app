import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { queueMetaEvent } from "@/lib/meta/capi";
import { hasActiveConsent } from "@/lib/consent";
import { issueQrToken } from "@/lib/ticket";
import { sendTicketEmail } from "@/lib/sendTicketEmail";
import { sendTicketLinkViaWhatsApp } from "@/lib/whatsapp/sendTicketLink";
import { registerParticipant } from "@/lib/zoom";
import { scheduleZoomAccessReminder } from "@/lib/qstash";
import type { Event, Person, Registration } from "@prisma/client";

// How long before a VIRTUAL/HYBRID event starts the personal Zoom link
// actually goes out (see WhatsAppAutomationTrigger.ZOOM_ACCESS_REMINDER's
// own schema comment for why it's withheld until then). 30 minutes is a
// reasonable default for "unos minutos antes" — change this single
// constant if the business wants a different lead time; there is no
// per-event override today.
const ZOOM_ACCESS_REMINDER_MINUTES_BEFORE = 30;

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
  // as before this existed (zoomJoinUrl stays undefined). Registering
  // now, even though the link isn't handed out yet, is deliberate: it's
  // what lets the delayed reminder below have a real link ready the
  // moment it's due, instead of calling Zoom's API again right before
  // the event (one more thing that could fail at the worst possible
  // time).
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
    // Persisted, but deliberately NOT handed to sendTicketEmail below —
    // see ZOOM_ACCESS_REMINDER_MINUTES_BEFORE above: the personal join
    // link doesn't go out anywhere yet (not the confirmation email, not
    // the payment-return landing page) until the delayed WhatsApp
    // reminder fires closer to the event. Persisting it here is only so
    // that later, delayed send can still find it.
    if (zoomJoinUrl) {
      await db.registration.update({ where: { id: registration.id }, data: { zoomJoinUrl } });
      // Only on the FIRST real confirmation — same "don't repeat a
      // side effect on a resend" gate as the Meta Purchase event below,
      // for the same reason: this function also runs again for a
      // resend of an already-CONFIRMED registration (see this
      // function's own top comment), and that must never queue a
      // second reminder for the same person. Best-effort, same posture
      // as the Zoom registration call above — a scheduling hiccup must
      // never fail the confirmation itself. Clamped to "now" when the
      // event is already sooner than the lead time (a last-minute
      // registration), instead of scheduling a call into the past
      // (QStash would just fire it immediately anyway, but being
      // explicit here is clearer than relying on that).
      if (!wasAlreadyConfirmed) {
        const sendAt = new Date(Math.max(event.startsAt.getTime() - ZOOM_ACCESS_REMINDER_MINUTES_BEFORE * 60_000, Date.now()));
        await scheduleZoomAccessReminder(registration.id, sendAt);
      }
    }
  }

  await sendTicketEmail({
    person,
    event,
    qrToken,
    registration: { id: registration.id, ticketTypeId: registration.ticketTypeId, ticketCount: registration.ticketCount },
    // NOT zoomJoinUrl — see this function's own comment above on why the
    // confirmation email doesn't include it either.
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
