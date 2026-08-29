import { db } from "@/lib/db";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { hasActiveConsent } from "@/lib/consent";
import { emailProvider } from "@/lib/email";
import { broadcastEmailHtml } from "@/lib/email/templates";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

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
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  if (!broadcast.eventId) throw new Error("sendEventBroadcast called on a non-event broadcast");
  if (!broadcast.bodyHtml) throw new Error("sendEventBroadcast called on a broadcast with no bodyHtml");

  await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENDING" } });

  const people = await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId);

  let sent = 0;
  let skippedNoConsent = 0;
  for (let i = 0; i < people.length; i += CONCURRENCY) {
    const chunk = people.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (person) => {
        if (!(await hasActiveConsent(person.id, "MARKETING"))) {
          skippedNoConsent++;
          return;
        }
        const unsubscribeUrl = buildUnsubscribeUrl(person.id);
        const content = broadcastEmailHtml({ subject: broadcast.subject, bodyHtml: broadcast.bodyHtml!, unsubscribeUrl });
        try {
          const result = await emailProvider.sendMarketing({
            to: person.email,
            subject: content.subject,
            text: content.text,
            html: content.html,
            listUnsubscribeHeader: `<${unsubscribeUrl}>`,
          });
          await db.emailLog.create({
            data: {
              kind: "MARKETING",
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
            data: { kind: "MARKETING", broadcastId: broadcast.id, personId: person.id, toEmail: person.email, status: "FAILED" },
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
