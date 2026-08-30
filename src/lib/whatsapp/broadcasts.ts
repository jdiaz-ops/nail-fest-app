import { db } from "@/lib/db";
import { hasActiveConsent } from "@/lib/consent";
import { getOrgSettings } from "@/lib/settings";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { resolveMergeTag } from "./mergeTags";
import type { Person, Event } from "@prisma/client";

// Same synchronous, concurrency-limited send as lib/broadcasts.ts — same
// known limitation flagged there (a real queue is the fix before a much
// larger send), kept identical rather than inventing a different number
// here for no reason.
const CONCURRENCY = 10;

interface Recipient {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "venueName"> | null;
}

export async function sendWhatsAppBroadcast(
  broadcastId: string
): Promise<{ sent: number; skippedNoConsent: number; skippedNoPhone: number; failed: number }> {
  const broadcast = await db.whatsAppBroadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { template: true, event: true, segment: true },
  });
  if (!broadcast.segmentId && !broadcast.eventId) throw new Error("WhatsAppBroadcast has neither segmentId nor eventId");
  if (broadcast.template.status !== "APPROVED") {
    throw new Error(`Template "${broadcast.template.name}" is not APPROVED (status: ${broadcast.template.status}) — re-sync or pick another.`);
  }

  await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENDING" } });

  const recipients: Recipient[] = broadcast.eventId
    ? (await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId)).map((r) => ({
        person: r.person,
        event: broadcast.event,
      }))
    : (await resolveSegment(broadcast.segment!.filter as unknown as SegmentFilter)).map((person) => ({ person, event: null }));

  const orgSettings = await getOrgSettings();
  const mapping = (broadcast.variableMapping ?? {}) as Record<string, string>;
  const variableKeys = Array.from({ length: broadcast.template.variableCount }, (_, i) => String(i + 1));

  let sent = 0;
  let skippedNoConsent = 0;
  let skippedNoPhone = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async ({ person, event }) => {
        if (!person.phone) {
          skippedNoPhone++;
          return;
        }
        if (!(await hasActiveConsent(person.id, "WHATSAPP"))) {
          skippedNoConsent++;
          return;
        }

        const variables = variableKeys.map((key) =>
          resolveMergeTag(mapping[key] ?? "", {
            person,
            event,
            timezone: orgSettings.timezone,
            language: orgSettings.language,
          })
        );
        const renderedBody = renderBody(broadcast.template.bodyText, variables);

        try {
          const result = await whatsappProvider.sendTemplate({
            to: person.phone,
            templateName: broadcast.template.name,
            languageCode: broadcast.template.language,
            variables,
          });
          await recordOutboundMessage({
            phone: person.phone,
            kind: "TEMPLATE",
            body: renderedBody,
            broadcastId: broadcast.id,
            templateId: broadcast.templateId,
            providerMessageId: result.providerMessageId,
            status: "SENT",
          });
          sent++;
        } catch (err) {
          await recordOutboundMessage({
            phone: person.phone!,
            kind: "TEMPLATE",
            body: renderedBody,
            broadcastId: broadcast.id,
            templateId: broadcast.templateId,
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          failed++;
          console.error("whatsapp broadcast send failed", person.phone, err);
        }
      })
    );
  }

  await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  return { sent, skippedNoConsent, skippedNoPhone, failed };
}

function renderBody(template: string | null, variables: string[]): string | null {
  if (!template) return null;
  let out = template;
  variables.forEach((value, i) => {
    out = out.split(`{{${i + 1}}}`).join(value || `{{${i + 1}}}`);
  });
  return out;
}

/** Every QUEUED, non-immediate WhatsApp broadcast whose computed due time
 * has arrived — see /api/whatsapp/send-due, the cron entry point. Same
 * shape as lib/broadcasts.ts's sendDueEventBroadcasts. */
export async function sendDueWhatsAppBroadcasts(now: Date = new Date()): Promise<{ processed: number }> {
  const { resolveDueAt, isDue } = await import("@/lib/broadcastSchedule");
  const candidates = await db.whatsAppBroadcast.findMany({
    where: { status: "QUEUED", scheduleKind: { not: "IMMEDIATE" } },
    include: { event: true },
  });
  let processed = 0;
  for (const b of candidates) {
    const dueAt = resolveDueAt(b, b.event);
    if (!isDue(dueAt, now)) continue;
    try {
      await sendWhatsAppBroadcast(b.id);
      processed++;
    } catch (err) {
      console.error("sendDueWhatsAppBroadcasts: failed to send", b.id, err);
    }
  }
  return { processed };
}
