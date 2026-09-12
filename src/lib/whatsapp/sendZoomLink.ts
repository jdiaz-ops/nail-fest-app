import { db } from "@/lib/db";
import { registerParticipant } from "@/lib/zoom";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";

/** On-demand "send me my Zoom link" — the WhatsApp-native equivalent of
 * "Reenviar PDF por WhatsApp" (sendTicketPdfViaWhatsApp), for when
 * someone writes in asking for their access link (or an admin wants to
 * hand it over early, from the Bandeja). Sent as plain FREEFORM text —
 * unlike the automatic ZOOM_ACCESS_REMINDER (a template, works outside
 * the 24h window), this is a live-conversation reply, subject to the
 * same 24h freeform rule as any other Bandeja send (the caller — the API
 * route / the AI agent — is expected to have already checked the
 * window).
 *
 * If zoomJoinUrl isn't stored yet (the automatic registration at
 * confirmation time hasn't run, or failed), retries it right here before
 * giving up — a person actively asking for their link is exactly the
 * moment worth one more attempt, not just reporting "not ready yet". */
export async function sendZoomLinkViaWhatsApp(
  registrationId: string,
  phone: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, person: true },
  });
  if (!registration) return { ok: false, error: "registration_not_found" };
  if (registration.status !== "CONFIRMED") return { ok: false, error: "not_confirmed" };
  if (registration.event.format === "IN_PERSON") return { ok: false, error: "not_a_virtual_event" };

  let joinUrl = registration.zoomJoinUrl;
  if (!joinUrl && registration.event.zoomMeetingId) {
    joinUrl =
      (await registerParticipant(registration.event.zoomMeetingId, registration.event.zoomIsWebinar, {
        email: registration.person.email,
        firstName: registration.person.firstName ?? "",
        lastName: registration.person.lastName ?? "",
      }).catch((err) => {
        console.error("sendZoomLinkViaWhatsApp: retry registration failed", registrationId, err);
        return null;
      })) ?? null;
    if (joinUrl) {
      await db.registration.update({ where: { id: registrationId }, data: { zoomJoinUrl: joinUrl } });
    }
  }
  if (!joinUrl) return { ok: false, error: "zoom_link_not_available" };

  const text = `Aquí tienes tu link personal para unirte a "${registration.event.name}" por Zoom:\n${joinUrl}\n\nEs personal — no lo compartas.`;

  try {
    const result = await whatsappProvider.sendFreeform({ to: phone, text });
    await recordOutboundMessage({ phone, kind: "FREEFORM", body: text, providerMessageId: result.providerMessageId, status: "SENT" });
    return { ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordOutboundMessage({ phone, kind: "FREEFORM", body: text, status: "FAILED", errorMessage });
    console.error("whatsapp send-zoom-link failed", registrationId, err);
    return { ok: false, error: errorMessage };
  }
}

/** Up to 5 most recent CONFIRMED registrations to a VIRTUAL/HYBRID event
 * with Zoom configured — what the Bandeja sidebar and the AI agent's
 * resend_zoom_link tool use to find what's resendable for this person.
 * Same cap/ordering as listResendableRegistrations (sendTicketPdf.ts's
 * own ticket-PDF equivalent). */
export async function listZoomResendableRegistrations(personId: string) {
  return db.registration.findMany({
    where: { personId, status: "CONFIRMED", event: { format: { not: "IN_PERSON" }, zoomMeetingId: { not: null } } },
    include: { event: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
