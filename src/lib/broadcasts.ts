import { db } from "@/lib/db";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { hasActiveConsent } from "@/lib/consent";
import { emailProvider } from "@/lib/email";
import { broadcastEmailHtml } from "@/lib/email/templates";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { getOrgSettings } from "@/lib/settings";

// KNOWN LIMITATION (flagged, not hidden — same reasoning as the original
// /api/broadcasts route this was extended from): sends synchronously in
// small concurrency-limited batches. Fine for a single event's audience;
// a background job/queue is the real fix before a 10k+ send from here.
const CONCURRENCY = 10;

/** The actual send — called either immediately (scheduleKind IMMEDIATE, from
 * the composer's own submit) or by the cron once a scheduled broadcast's
 * due time arrives (see lib/broadcastSchedule.ts). Same real send path
 * both times, not two copies that could drift. */
export async function sendEventBroadcast(broadcastId: string): Promise<{ sent: number; skippedNoConsent: number }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, include: { event: true } });
  if (!broadcast.eventId || !broadcast.event) throw new Error("sendEventBroadcast called on a non-event broadcast");
  if (!broadcast.bodyHtml) throw new Error("sendEventBroadcast called on a broadcast with no bodyHtml");

  await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENDING" } });

  const recipients = await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId);

  // Resolved once, up front, only if the "adjuntar entrada" checkbox is on
  // (see EventBroadcastComposer.tsx) — recipients can hold different
  // ticket types even within "all buyers", so each PDF needs its own
  // ticketTypeName looked up by that recipient's own registration, not
  // the broadcast's (optional) narrowing ticketTypeId.
  const orgSettings = broadcast.attachTicketPdf ? await getOrgSettings() : null;
  const ticketTypeIds = [...new Set(recipients.map((r) => r.registration.ticketTypeId).filter((id): id is string => !!id))];
  const ticketTypeNames = ticketTypeIds.length
    ? new Map((await db.ticketType.findMany({ where: { id: { in: ticketTypeIds } } })).map((t) => [t.id, t.name]))
    : new Map<string, string>();

  let sent = 0;
  let skippedNoConsent = 0;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async ({ person, registration }) => {
        // LOGISTICS, not MARKETING — an event-scoped broadcast is
        // operational communication tied to this person's own
        // registration (schedule changes, venue/logistics reminders,
        // day-of info), same category as the ticket confirmation itself,
        // not a cross-event promotional send. LOGISTICS is a REQUIRED
        // consent to register at all (see lib/consent.ts's
        // REQUIRED_CONSENTS), so this check is defensive rather than a
        // real filter — it exists so a registration whose consent was
        // manually revoked from the CRM doesn't still get mailed. Sending
        // this channel gated on MARKETING consent instead used to be a
        // real bug: /api/unsubscribe's own copy already promised "you'll
        // keep receiving operational info about events you register
        // for" — that promise only holds if this check is LOGISTICS.
        if (!(await hasActiveConsent(person.id, "LOGISTICS"))) {
          skippedNoConsent++;
          return;
        }
        // No unsubscribeUrl — see broadcastEmailHtml's own comment on why
        // an event broadcast doesn't offer one: LOGISTICS can't be
        // revoked while staying registered, so a "darme de baja" link
        // here would be a broken promise, not a real opt-out.
        const content = broadcastEmailHtml({ subject: broadcast.subject, bodyHtml: broadcast.bodyHtml! });
        // Same "never let a PDF problem block the whole send" reasoning as
        // sendTicketEmail.ts — a recipient with no qrToken (shouldn't
        // happen for a CONFIRMED registration, but not guaranteed by the
        // schema) just gets the broadcast without the attachment rather
        // than failing their send entirely.
        const pdfAttachment =
          orgSettings && registration.qrToken
            ? await renderTicketPdfBuffer({
                firstName: person.firstName ?? "",
                lastName: person.lastName ?? undefined,
                eventName: broadcast.event!.name,
                venueName: broadcast.event!.venueName ?? undefined,
                venueAddress: broadcast.event!.venueAddress ?? undefined,
                startsAt: broadcast.event!.startsAt,
                endsAt: broadcast.event!.endsAt ?? undefined,
                ticketTypeName: registration.ticketTypeId ? ticketTypeNames.get(registration.ticketTypeId) : undefined,
                ticketCount: registration.ticketCount,
                confirmationCode: registration.id.slice(-8).toUpperCase(),
                qrToken: registration.qrToken,
                timezone: orgSettings.timezone,
                language: orgSettings.language,
              }).catch((err) => {
                console.error("broadcast ticket PDF render failed", person.email, err);
                return null;
              })
            : null;
        try {
          const result = await emailProvider.sendTransactional({
            to: person.email,
            subject: content.subject,
            text: content.text,
            html: content.html,
            attachments: pdfAttachment
              ? [{ filename: "entrada-nailfest.pdf", content: pdfAttachment, contentType: "application/pdf" }]
              : undefined,
          });
          await db.emailLog.create({
            data: {
              kind: "TRANSACTIONAL",
              broadcastId: broadcast.id,
              personId: person.id,
              toEmail: person.email,
              sesMessageId: result.providerMessageId,
              status: "SENT",
            },
          });
          sent++;
        } catch (err) {
          await db.emailLog.create({
            data: { kind: "TRANSACTIONAL", broadcastId: broadcast.id, personId: person.id, toEmail: person.email, status: "FAILED" },
          });
          console.error("event broadcast send failed", person.email, err);
        }
      })
    );
  }

  await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  return { sent, skippedNoConsent };
}

/** Every QUEUED, non-immediate broadcast whose computed due time has
 * arrived — see /api/broadcasts/send-due, the cron entry point. */
export async function sendDueEventBroadcasts(now: Date = new Date()): Promise<{ processed: number }> {
  const { resolveDueAt, isDue } = await import("@/lib/broadcastSchedule");
  const candidates = await db.emailBroadcast.findMany({
    where: { status: "QUEUED", eventId: { not: null }, scheduleKind: { not: "IMMEDIATE" } },
    include: { event: true },
  });
  let processed = 0;
  for (const b of candidates) {
    const dueAt = resolveDueAt(b, b.event);
    if (!isDue(dueAt, now)) continue;
    try {
      await sendEventBroadcast(b.id);
      processed++;
    } catch (err) {
      console.error("sendDueEventBroadcasts: failed to send", b.id, err);
    }
  }
  return { processed };
}
