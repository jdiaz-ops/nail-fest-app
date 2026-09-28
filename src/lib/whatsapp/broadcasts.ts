import { db } from "@/lib/db";
import { hasActiveConsent, bulkActiveConsent } from "@/lib/consent";
import { getOrgSettings, type OrgSettingsValue } from "@/lib/settings";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { publishChunkContinuation } from "@/lib/qstash";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { resolveMergeTag } from "./mergeTags";
import { dynamicUrlButtonIndex } from "./automations";
import type { WhatsAppTemplateButton } from "./provider";
import type { Person, Event, WhatsAppBroadcast, WhatsAppTemplate } from "@prisma/client";

const CONCURRENCY = 10;
// How many recipients one chunk sends before either finishing or handing
// the rest off to QStash (see sendWhatsAppBroadcast's own comment) — big
// enough that a typical event's audience (hundreds, sometimes low
// thousands) finishes in one chunk with no behavior change at all;
// small enough that CHUNK_SIZE / CONCURRENCY batches of real network
// calls comfortably fit inside one serverless function invocation.
const CHUNK_SIZE = 500;

interface Recipient {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays"> | null;
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

/** The template's per-person link button ("Ver mi entrada", a URL ending
 * in {{1}}), if it has one: where it sits among the template's buttons
 * and which event's entrada fills it — the difusión's chosen ticket
 * event, or an event-scoped broadcast's own event. Null when the template
 * has no such button. */
function ticketButtonFor(broadcast: BroadcastWithTemplate): { index: number; url: string; eventId: string | null } | null {
  const index = dynamicUrlButtonIndex(broadcast.template.buttons);
  if (index < 0) return null;
  const button = (broadcast.template.buttons as unknown as WhatsAppTemplateButton[])[index] as Extract<WhatsAppTemplateButton, { type: "URL" }>;
  return { index, url: button.url, eventId: broadcast.ticketEventId ?? broadcast.eventId };
}

/** personId -> that person's own ticket token for the event (their
 * confirmed registration's qrToken — ticket 1 of the order; the PDF it
 * opens carries every ticket of the order, see lib/ticketPdf.ts). Someone
 * with no confirmed registration there is simply absent from the map. */
async function ticketTokensFor(eventId: string, personIds: string[]): Promise<Map<string, string>> {
  if (personIds.length === 0) return new Map();
  const rows = await db.registration.findMany({
    where: { eventId, personId: { in: personIds }, status: "CONFIRMED", qrToken: { not: null } },
    select: { personId: true, qrToken: true },
  });
  return new Map(rows.map((r) => [r.personId, r.qrToken as string]));
}

/** One recipient's send attempt — shared by the main broadcast loop and
 * retryFailedMessages(), so a retry renders variables and logs exactly
 * the same way the original send did, not a second copy that could
 * drift. Returns "sent" | "failed" (never throws — same "log every
 * attempt" posture as the rest of this module). `ticketToken` fills the
 * template's per-person link button — see ticketButtonFor; callers never
 * reach here for a button template without one. */
async function sendOneTemplateMessage(
  broadcast: BroadcastWithTemplate,
  person: Person,
  event: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays"> | null,
  orgSettings: OrgSettingsValue,
  ticketToken?: string
): Promise<"sent" | "failed"> {
  const mapping = (broadcast.variableMapping ?? {}) as Record<string, string>;
  const variableKeys = Array.from({ length: broadcast.template.variableCount }, (_, i) => String(i + 1));
  const variables = variableKeys.map((key) =>
    resolveMergeTag(mapping[key] ?? "", { person, event, timezone: orgSettings.timezone, language: orgSettings.language })
  );
  const button = ticketButtonFor(broadcast);
  const withButton = button && ticketToken ? { buttonUrlParam: ticketToken, buttonIndex: button.index } : {};
  // The bandeja shows exactly what went out — including the link this
  // person's button actually opens, same as the registration
  // confirmation's own log line.
  const body = renderBody(broadcast.template.bodyText, variables);
  const renderedBody =
    button && ticketToken ? `${body ?? ""}\n[enlace del botón] ${button.url.replace(/\{\{\s*1\s*\}\}/, ticketToken)}`.trim() : body;

  try {
    const result = await whatsappProvider.sendTemplate({
      to: person.phone!,
      templateName: broadcast.template.name,
      languageCode: broadcast.template.language,
      variables,
      ...withButton,
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

/** Same eligibility rules sendWhatsAppBroadcast enforces (phone, then
 * consent, then — for a template with a "Ver mi entrada" button — a
 * confirmed ticket for the chosen event), computed ahead of time so the
 * composer can show the real breakdown BEFORE the send happens instead of
 * only after — a segment can look like "12 personas" and still only reach
 * 3 of them; finding that out after clicking Enviar is a bad surprise.
 * Never sends anything itself. */
export async function previewSegmentRecipients(
  segmentId: string,
  ticketEventId?: string | null
): Promise<{ total: number; eligible: number; noConsent: number; noPhone: number; noTicket: number }> {
  const segment = await db.segmentDefinition.findUniqueOrThrow({ where: { id: segmentId } });
  const people = await resolveSegment(segment.filter as unknown as SegmentFilter);
  const consented = await bulkActiveConsent(people.map((p) => p.id), "WHATSAPP");
  const reachable = people.filter((p) => p.phone && consented.has(p.id));
  const tickets = ticketEventId ? await ticketTokensFor(ticketEventId, reachable.map((p) => p.id)) : null;

  let eligible = 0;
  let noConsent = 0;
  let noPhone = 0;
  let noTicket = 0;
  for (const person of people) {
    if (!person.phone) {
      noPhone++;
    } else if (!consented.has(person.id)) {
      noConsent++;
    } else if (tickets && !tickets.has(person.id)) {
      noTicket++;
    } else {
      eligible++;
    }
  }
  return { total: people.length, eligible, noConsent, noPhone, noTicket };
}

/** Sends the next chunk of a broadcast, picking up wherever its persisted
 * cursor left off, and either finishes it (status -> SENT) or hands the
 * rest to a QStash callback (see lib/qstash.ts's chunk-continuation
 * functions) so a big segment never has to fit inside one function
 * invocation. This is the real fix for the "a background job/queue is
 * the fix before a 10k+ send" limitation this module used to just flag
 * and accept — see the commit this comment shipped with.
 *
 * The full recipient list is resolved ONCE (on the very first call for
 * this broadcast) and frozen as `recipientPersonIds` on the row itself —
 * never re-resolved on a later chunk, so a segment gaining/losing members
 * mid-send can't skip anyone or double-send to someone who left it.
 * `cursor` is how many of that frozen list have been processed (sent,
 * skipped, or failed) so far.
 *
 * Without QStash configured this still completes a broadcast of any
 * size — it just keeps looping chunk after chunk in the SAME call,
 * exactly the synchronous behavior this had before chunking existed (see
 * `backgrounded: false` in the return value); the risk that used to be
 * flagged (a huge send exceeding the function's time limit) is smaller
 * now that each chunk's own accounting doesn't restart, but isn't fully
 * gone without QStash — surfaced to the caller as a warning, not hidden. */
export async function sendWhatsAppBroadcast(
  broadcastId: string
): Promise<{
  sent: number;
  skippedNoConsent: number;
  skippedNoPhone: number;
  skippedNoTicket: number;
  failed: number;
  remaining: number;
  backgrounded: boolean;
}> {
  const broadcast = await db.whatsAppBroadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { template: true, event: true, segment: true },
  });
  if (!broadcast.segmentId && !broadcast.eventId) throw new Error("WhatsAppBroadcast has neither segmentId nor eventId");
  if (broadcast.template.status !== "APPROVED") {
    throw new Error(`Template "${broadcast.template.name}" is not APPROVED (status: ${broadcast.template.status}) — re-sync or pick another.`);
  }
  // A "Ver mi entrada" button with no event to pull entradas from would be
  // rejected by Meta for every single recipient — refuse up front instead.
  const ticketButton = ticketButtonFor(broadcast);
  if (ticketButton && !ticketButton.eventId) {
    throw new Error(
      `La plantilla "${broadcast.template.name}" tiene un botón con enlace personal, pero esta difusión no tiene evento elegido para la entrada.`
    );
  }

  const event: Recipient["event"] = broadcast.eventId ? broadcast.event : null;

  // First call for this broadcast: resolve the full recipient list once
  // and freeze it. A later (continuation) call reuses the frozen list —
  // never re-resolves the segment/event membership.
  let recipientIds: string[];
  if (broadcast.recipientPersonIds) {
    recipientIds = broadcast.recipientPersonIds as unknown as string[];
  } else {
    const recipients: Recipient[] = broadcast.eventId
      ? (await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId)).map((r) => ({ person: r.person, event }))
      : (await resolveSegment(broadcast.segment!.filter as unknown as SegmentFilter)).map((person) => ({ person, event: null }));
    recipientIds = recipients.map((r) => r.person.id);
    await db.whatsAppBroadcast.update({
      where: { id: broadcast.id },
      data: { status: "SENDING", recipientPersonIds: recipientIds },
    });
  }

  const orgSettings = await getOrgSettings();

  let sent = 0;
  let skippedNoConsent = 0;
  let skippedNoPhone = 0;
  let skippedNoTicket = 0;
  let failed = 0;
  let cursor = broadcast.cursor;
  let backgrounded = false;

  while (cursor < recipientIds.length) {
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    const people = await db.person.findMany({ where: { id: { in: chunkIds } } });
    const peopleById = new Map(people.map((p) => [p.id, p]));
    // One bulk consent check for the whole chunk instead of one DB round
    // trip per person inside the loop below — see bulkActiveConsent's own
    // comment; matters a lot once a segment runs into the thousands (a
    // real Nail Fest segment easily does).
    const consented = await bulkActiveConsent(chunkIds, "WHATSAPP");
    const tickets = ticketButton?.eventId ? await ticketTokensFor(ticketButton.eventId, chunkIds) : null;
    // Belt-and-suspenders against a duplicate send if this exact chunk
    // gets retried after a crash partway through (cursor only advances
    // once the whole chunk finishes) — skip anyone who somehow already
    // has a message row for this broadcast+chunk.
    const alreadyAttempted = new Set(
      (
        await db.whatsAppMessage.findMany({
          where: { broadcastId, kind: "TEMPLATE", conversation: { personId: { in: chunkIds } } },
          select: { conversation: { select: { personId: true } } },
        })
      ).map((m) => m.conversation.personId)
    );

    // Collected per chunk, not across the whole send — Promise.allSettled
    // callbacks below run sequentially with respect to this array (Node
    // is single-threaded; no lock needed), so this is just "everyone in
    // THIS chunk who SENT successfully," used right after for assignLabel.
    const sentPersonIds: string[] = [];

    for (let i = 0; i < chunkIds.length; i += CONCURRENCY) {
      const sub = chunkIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        sub.map(async (personId) => {
          if (alreadyAttempted.has(personId)) return;
          const person = peopleById.get(personId);
          if (!person) {
            skippedNoPhone++; // a person deleted since the list was frozen — nothing to send to
            return;
          }
          if (!person.phone) {
            skippedNoPhone++;
            return;
          }
          if (!consented.has(person.id)) {
            skippedNoConsent++;
            return;
          }
          // Button template, but no confirmed entrada for that event — a
          // send would carry a broken "Ver mi entrada" (or be rejected
          // outright), so this person gets nothing and is counted apart.
          const ticketToken = tickets?.get(person.id);
          if (tickets && !ticketToken) {
            skippedNoTicket++;
            return;
          }
          const outcome = await sendOneTemplateMessage(broadcast, person, event, orgSettings, ticketToken);
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
        .catch((err) => console.error("whatsapp broadcast: failed to assign label after chunk", err));
    }

    cursor += chunkIds.length;
    await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { cursor } });

    if (cursor >= recipientIds.length) break; // done — falls through to the SENT update below

    const messageId = await publishChunkContinuation("whatsapp", broadcastId);
    if (messageId) {
      backgrounded = true;
      break; // the rest continues in a later invocation, not this one
    }
    // QStash unavailable — keep going in this same call (today's
    // pre-chunking behavior), rather than leaving the broadcast stuck.
  }

  const remaining = recipientIds.length - cursor;
  if (remaining === 0) {
    await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  }
  return { sent, skippedNoConsent, skippedNoPhone, skippedNoTicket, failed, remaining, backgrounded };
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
  const ticketButton = ticketButtonFor(broadcast);
  const tickets = ticketButton?.eventId
    ? await ticketTokensFor(
        ticketButton.eventId,
        failedMessages.flatMap((m) => (m.conversation.person ? [m.conversation.person.id] : []))
      )
    : null;

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
    // Same rule as the original send: a button template needs this
    // person's own entrada (it may have been cancelled since).
    const ticketToken = tickets?.get(person.id);
    if (ticketButton && !ticketToken) {
      skipped++;
      continue;
    }
    const outcome = await sendOneTemplateMessage(broadcast, person, broadcast.event, orgSettings, ticketToken);
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
