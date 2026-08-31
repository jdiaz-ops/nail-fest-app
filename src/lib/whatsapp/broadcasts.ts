import { db } from "@/lib/db";
import { hasActiveConsent, bulkActiveConsent } from "@/lib/consent";
import { getOrgSettings, type OrgSettingsValue } from "@/lib/settings";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { resolveMergeTag } from "./mergeTags";
import type { Person, Event, WhatsAppBroadcast, WhatsAppTemplate } from "@prisma/client";

// Same synchronous, concurrency-limited send as lib/broadcasts.ts — same
// known limitation flagged there (a real queue is the fix before a much
// larger send), kept identical rather than inventing a different number
// here for no reason.
const CONCURRENCY = 10;

interface Recipient {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "venueName"> | null;
}

type BroadcastWithTemplate = WhatsAppBroadcast & { template: WhatsAppTemplate };

function renderBody(template: string | null, variables: string[]): string | null {
  if (!template) return null;
  let out = template;
  variables.forEach((value, i) => {
    out = out.split(`{{${i + 1}}}`).join(value || `{{${i + 1}}}`);
  });
  return out;
}

/** One recipient's send attempt — shared by the main broadcast loop and
 * retryFailedMessages(), so a retry renders variables and logs exactly
 * the same way the original send did, not a second copy that could
 * drift. Returns "sent" | "failed" (never throws — same "log every
 * attempt" posture as the rest of this module). */
async function sendOneTemplateMessage(
  broadcast: BroadcastWithTemplate,
  person: Person,
  event: Pick<Event, "name" | "startsAt" | "venueName"> | null,
  orgSettings: OrgSettingsValue
): Promise<"sent" | "failed"> {
  const mapping = (broadcast.variableMapping ?? {}) as Record<string, string>;
  const variableKeys = Array.from({ length: broadcast.template.variableCount }, (_, i) => String(i + 1));
  const variables = variableKeys.map((key) =>
    resolveMergeTag(mapping[key] ?? "", { person, event, timezone: orgSettings.timezone, language: orgSettings.language })
  );
  const renderedBody = renderBody(broadcast.template.bodyText, variables);

  try {
    const result = await whatsappProvider.sendTemplate({
      to: person.phone!,
      templateName: broadcast.template.name,
      languageCode: broadcast.template.language,
      variables,
    });
    await recordOutboundMessage({
      phone: person.phone!,
      kind: "TEMPLATE",
      body: renderedBody,
      broadcastId: broadcast.id,
      templateId: broadcast.templateId,
      providerMessageId: result.providerMessageId,
      status: "SENT",
    });
    return "sent";
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
    console.error("whatsapp broadcast send failed", person.phone, err);
    return "failed";
  }
}

/** Same eligibility rules sendWhatsAppBroadcast enforces (consent, then
 * phone), computed ahead of time so the composer can show the real
 * breakdown BEFORE the send happens instead of only after — a segment
 * can look like "12 personas" and still only reach 3 of them; finding
 * that out after clicking Enviar is a bad surprise. Never sends
 * anything itself. */
export async function previewSegmentRecipients(
  segmentId: string
): Promise<{ total: number; eligible: number; noConsent: number; noPhone: number }> {
  const segment = await db.segmentDefinition.findUniqueOrThrow({ where: { id: segmentId } });
  const people = await resolveSegment(segment.filter as unknown as SegmentFilter);
  const consented = await bulkActiveConsent(people.map((p) => p.id), "WHATSAPP");

  let eligible = 0;
  let noConsent = 0;
  let noPhone = 0;
  for (const person of people) {
    if (!person.phone) {
      noPhone++;
    } else if (!consented.has(person.id)) {
      noConsent++;
    } else {
      eligible++;
    }
  }
  return { total: people.length, eligible, noConsent, noPhone };
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
  // One bulk consent check for the whole recipient list instead of one
  // DB round trip per person inside the loop below — see
  // bulkActiveConsent's own comment; matters a lot once a segment runs
  // into the thousands (a real Nail Fest segment easily does).
  const consented = await bulkActiveConsent(recipients.map((r) => r.person.id), "WHATSAPP");

  let sent = 0;
  let skippedNoConsent = 0;
  let skippedNoPhone = 0;
  let failed = 0;
  // Collected across the whole send, not per-chunk — Promise.allSettled
  // callbacks below run sequentially with respect to this array (Node is
  // single-threaded; no lock needed) so this is just "everyone SENT
  // successfully", used once at the end for assignLabel.
  const sentPersonIds: string[] = [];

  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const chunk = recipients.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async ({ person, event }) => {
        if (!person.phone) {
          skippedNoPhone++;
          return;
        }
        if (!consented.has(person.id)) {
          skippedNoConsent++;
          return;
        }
        const outcome = await sendOneTemplateMessage(broadcast, person, event, orgSettings);
        if (outcome === "sent") {
          sent++;
          sentPersonIds.push(person.id);
        } else {
          failed++;
        }
      })
    );
  }

  if (broadcast.assignLabelId && sentPersonIds.length > 0) {
    await db.label
      .update({
        where: { id: broadcast.assignLabelId },
        data: { people: { connect: sentPersonIds.map((id) => ({ id })) } },
      })
      .catch((err) => console.error("whatsapp broadcast: failed to assign label after send", err));
  }

  await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  return { sent, skippedNoConsent, skippedNoPhone, failed };
}

/** Re-attempts every FAILED message logged for this broadcast — for a
 * transient failure (network blip, a token that just got fixed), not a
 * way around a real rejection (an unapproved template, a revoked
 * consent — hasActiveConsent is re-checked here too, so a consent
 * revoked since the original send still blocks the retry). Skips a
 * FAILED row with no linked Person (shouldn't happen — every original
 * send resolved a real Person first — but never silently guesses one). */
export async function retryFailedMessages(broadcastId: string): Promise<{ retried: number; sent: number; failed: number; skipped: number }> {
  const broadcast = await db.whatsAppBroadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { template: true, event: true },
  });

  const failedMessages = await db.whatsAppMessage.findMany({
    where: { broadcastId, kind: "TEMPLATE", status: "FAILED" },
    include: { conversation: { include: { person: true } } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const orgSettings = await getOrgSettings();

  for (const msg of failedMessages) {
    const person = msg.conversation.person;
    if (!person || !person.phone) {
      skipped++;
      continue;
    }
    if (!(await hasActiveConsent(person.id, "WHATSAPP"))) {
      skipped++;
      continue;
    }
    const outcome = await sendOneTemplateMessage(broadcast, person, broadcast.event, orgSettings);
    if (outcome === "sent") sent++;
    else failed++;
  }

  return { retried: failedMessages.length, sent, failed, skipped };
}

/** Delivery breakdown for one broadcast's history row — Processed/
 * Delivered/Opened(=READ)/Unreached(=FAILED), same shape as WhatChimp's
 * own Broadcast Center table. Reads straight from WhatsAppMessage.status,
 * which the webhook keeps current (see lib/whatsapp/inbox.ts's
 * handleStatusUpdate) — no separate tracking needed. */
export interface BroadcastStats {
  processed: number;
  delivered: number;
  read: number;
  failed: number;
}

export async function getBroadcastStats(broadcastId: string): Promise<BroadcastStats> {
  const rows = await db.whatsAppMessage.groupBy({
    by: ["status"],
    where: { broadcastId, kind: "TEMPLATE" },
    _count: { _all: true },
  });
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const processed = rows.reduce((sum, r) => sum + r._count._all, 0);
  return {
    processed,
    // DELIVERED/READ both count as "delivered" for this stat (READ implies
    // it was delivered first) — SENT alone (no delivery receipt yet) does
    // not, since that's still in flight.
    delivered: (byStatus.DELIVERED ?? 0) + (byStatus.READ ?? 0),
    read: byStatus.READ ?? 0,
    failed: byStatus.FAILED ?? 0,
  };
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
