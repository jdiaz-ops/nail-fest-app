import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { hasActiveConsent, bulkActiveConsent } from "@/lib/consent";
import { getOrgSettings, type OrgSettingsValue } from "@/lib/settings";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { publishChunkContinuation, scheduleWhatsAppBroadcastSend, scheduleAutoRetry, AUTO_RETRY_DELAYS_SECONDS, QSTASH_MAX_DELAY_MS, CHUNK_WATCHDOG_SECONDS, CHUNK_LOCK_SECONDS } from "@/lib/qstash";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";
import { categorizeWhatsAppFailure, WHATSAPP_FAILURE_INFO, type WhatsAppFailureCategory } from "./failureCategories";
import { resolveMergeTag } from "./mergeTags";
import { dynamicUrlButtonIndex } from "./automations";
import type { WhatsAppTemplateButton } from "./provider";
import type { Person, Event, WhatsAppBroadcast, WhatsAppTemplate, WhatsAppMessageStatus } from "@prisma/client";

const CONCURRENCY = 10;
// How many recipients one chunk sends before either finishing or handing
// the rest off to QStash (see sendWhatsAppBroadcast's own comment) — big
// enough that a typical event's audience (hundreds, sometimes low
// thousands) finishes in one chunk with no behavior change at all;
// small enough that CHUNK_SIZE / CONCURRENCY batches of real network
// calls comfortably fit inside one serverless function invocation.
// 100, not 500 — same reasoning as lib/broadcasts.ts: a chunk must finish
// inside Vercel's 60s cap (Cúcuta's first send died at 329 of a 500 chunk).
const CHUNK_SIZE = 100;

interface Recipient {
  person: Person;
  event: Pick<Event, "name" | "publicName" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays"> | null;
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

/** personId -> who that confirmed ticket belongs to, as a key: the cédula
 * answered at checkout (digits only), or null when there is none. Only
 * used to tell "the same woman registered twice with two emails" from
 * "two people who share one WhatsApp number" — see onePerPhone. */
async function ticketHoldersFor(eventId: string, personIds: string[]): Promise<Map<string, string | null>> {
  if (personIds.length === 0) return new Map();
  const rows = await db.registration.findMany({
    where: { eventId, personId: { in: personIds }, status: "CONFIRMED", qrToken: { not: null } },
    select: { personId: true, customFields: true },
  });
  return new Map(
    rows.map((r) => {
      const fields = r.customFields && typeof r.customFields === "object" && !Array.isArray(r.customFields) ? (r.customFields as Record<string, unknown>) : {};
      const cedula = typeof fields.cedula === "string" ? fields.cedula.replace(/\D/g, "").replace(/^0+/, "") : "";
      return [r.personId, cedula || null];
    })
  );
}

/** "+57 313 405 8607", "573134058607" and "3134058607" are one WhatsApp. */
function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "").slice(-10);
  return digits.length >= 7 ? digits : null;
}

/** The recipients to leave out so each WhatsApp number gets ONE message:
 * the same person often exists twice in the CRM (registered again with a
 * second email when the first ticket email never arrived), both with the
 * same phone. Only people who would actually receive the message compete
 * for their number — a contact without consent never "uses up" it.
 *
 * With `holders` (a "Ver mi entrada" send), two contacts on one number
 * both get their message when their cédulas differ — a mother and
 * daughter sharing a phone each need their own entrada; the same cédula,
 * or one missing, is treated as the same person. The first one in list
 * order keeps the number. */
export function duplicatePhoneRecipients(
  people: { id: string; phone: string | null }[],
  willReceive: (personId: string) => boolean,
  holders?: Map<string, string | null>
): Set<string> {
  const seenByPhone = new Map<string, (string | null)[]>();
  const duplicates = new Set<string>();
  for (const person of people) {
    const phone = phoneKey(person.phone);
    if (!phone || !willReceive(person.id)) continue;
    const holder = holders ? (holders.get(person.id) ?? null) : null;
    const seen = seenByPhone.get(phone);
    if (!seen) {
      seenByPhone.set(phone, [holder]);
    } else if (holders && holder && seen.every((h) => h && h !== holder)) {
      seen.push(holder); // a different person on the same number
    } else {
      duplicates.add(person.id);
    }
  }
  return duplicates;
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
  event: Pick<Event, "name" | "publicName" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays"> | null,
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
): Promise<{ total: number; eligible: number; noConsent: number; noPhone: number; noTicket: number; duplicatePhone: number }> {
  const segment = await db.segmentDefinition.findUniqueOrThrow({ where: { id: segmentId } });
  const people = await resolveSegment(segment.filter as unknown as SegmentFilter);
  const consented = await bulkActiveConsent(people.map((p) => p.id), "WHATSAPP");
  const reachable = people.filter((p) => p.phone && consented.has(p.id));
  const [tickets, holders] = ticketEventId
    ? await Promise.all([ticketTokensFor(ticketEventId, reachable.map((p) => p.id)), ticketHoldersFor(ticketEventId, reachable.map((p) => p.id))])
    : [null, undefined];
  const duplicates = duplicatePhoneRecipients(people, (id) => consented.has(id) && (!tickets || tickets.has(id)), holders);

  let eligible = 0;
  let noConsent = 0;
  let noPhone = 0;
  let noTicket = 0;
  for (const person of people) {
    if (duplicates.has(person.id)) continue;
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
  return { total: people.length, eligible, noConsent, noPhone, noTicket, duplicatePhone: duplicates.size };
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
  /** Left out because another contact with the same WhatsApp number already
   * gets this message — see duplicatePhoneRecipients. Counted on the call
   * that freezes the list (the one the composer waits for); 0 afterwards. */
  skippedDuplicatePhone: number;
  failed: number;
  remaining: number;
  backgrounded: boolean;
  /** True when another invocation already holds this send's lock (see
   * WhatsAppBroadcast.lockedUntil) — nothing was sent by this call. */
  locked: boolean;
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
  let skippedDuplicatePhone = 0;
  if (broadcast.recipientPersonIds) {
    recipientIds = broadcast.recipientPersonIds as unknown as string[];
  } else {
    const recipients: Recipient[] = broadcast.eventId
      ? (await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId)).map((r) => ({ person: r.person, event }))
      : (await resolveSegment(broadcast.segment!.filter as unknown as SegmentFilter)).map((person) => ({ person, event: null }));
    // One message per WhatsApp number, decided once here and frozen with
    // the list — the per-chunk loop below never sees the left-out ones.
    const people = recipients.map((r) => r.person);
    const allIds = people.map((p) => p.id);
    const consentedAll = await bulkActiveConsent(allIds, "WHATSAPP");
    const [ticketsAll, holders] = ticketButton?.eventId
      ? await Promise.all([ticketTokensFor(ticketButton.eventId, allIds), ticketHoldersFor(ticketButton.eventId, allIds)])
      : [null, undefined];
    const duplicates = duplicatePhoneRecipients(people, (id) => consentedAll.has(id) && (!ticketsAll || ticketsAll.has(id)), holders);
    skippedDuplicatePhone = duplicates.size;
    recipientIds = allIds.filter((id) => !duplicates.has(id));
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
    // One invocation at a time: claim the send before touching the chunk.
    // Whoever loses this race (a "Reanudar envío" pressed while a
    // continuation is already running, a watchdog landing early, QStash
    // retrying a call that is still alive) leaves without sending — the
    // holder's own continuation/watchdog carries the send forward.
    const claimed = await db.whatsAppBroadcast.updateMany({
      where: { id: broadcastId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
      data: { lockedUntil: new Date(Date.now() + CHUNK_LOCK_SECONDS * 1000) },
    });
    if (claimed.count === 0) {
      const remaining = recipientIds.length - cursor;
      return { sent, skippedNoConsent, skippedNoPhone, skippedNoTicket, skippedDuplicatePhone, failed, remaining, backgrounded: true, locked: true };
    }
    // The lock holder's cursor is the truth, not the one this call read
    // before claiming — a continuation that finished a chunk between the
    // read and the claim must not be replayed.
    const current = await db.whatsAppBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, select: { cursor: true } });
    if (current.cursor !== cursor) {
      cursor = current.cursor;
      if (cursor >= recipientIds.length) break;
    }
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    await publishChunkContinuation("whatsapp", broadcastId, { delaySeconds: CHUNK_WATCHDOG_SECONDS, expectCursor: cursor });
    const people = await db.person.findMany({ where: { id: { in: chunkIds } } });
    const peopleById = new Map(people.map((p) => [p.id, p]));
    // One bulk consent check for the whole chunk instead of one DB round
    // trip per person inside the loop below — see bulkActiveConsent's own
    // comment; matters a lot once a segment runs into the thousands (a
    // real Nail Fest segment easily does).
    const consented = await bulkActiveConsent(chunkIds, "WHATSAPP");
    const tickets = ticketButton?.eventId ? await ticketTokensFor(ticketButton.eventId, chunkIds) : null;
    // Never message a number twice for this broadcast — the guard that
    // makes resuming a chunk that died partway (cursor only advances once
    // the whole chunk finishes) safe. Matched by NUMBER, not by person: a
    // message row hangs off the phone's one conversation, whose personId
    // is whichever CRM contact matched that phone first, which is often
    // NOT the contact this frozen list carries for the same number (the
    // same person registered twice, a shared family phone). Matching on
    // conversation.personId alone let the 2026-10-07 Colombia resume
    // re-send to people the first run had already reached.
    const alreadyMessaged = await alreadyMessagedInBroadcast(broadcastId, people);

    // Collected per chunk, not across the whole send — Promise.allSettled
    // callbacks below run sequentially with respect to this array (Node
    // is single-threaded; no lock needed), so this is just "everyone in
    // THIS chunk who SENT successfully," used right after for assignLabel.
    const sentPersonIds: string[] = [];

    for (let i = 0; i < chunkIds.length; i += CONCURRENCY) {
      const sub = chunkIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        sub.map(async (personId) => {
          const person = peopleById.get(personId);
          if (person && alreadyMessaged(person)) return;
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
    // Chunk done: advance the cursor and hand the lock back in the same
    // write, so the continuation (or a watchdog) can claim it.
    await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { cursor, lockedUntil: null } });

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
    await db.whatsAppBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date(), lockedUntil: null } });
    // Book the automatic retry of whatever failed for a passing reason
    // (lib/autoRetry.ts) — and the report that goes with it.
    await scheduleAutoRetry("whatsapp", broadcastId, AUTO_RETRY_DELAYS_SECONDS.whatsapp[1]!);
  }
  return { sent, skippedNoConsent, skippedNoPhone, skippedNoTicket, skippedDuplicatePhone, failed, remaining, backgrounded, locked: false };
}

/** Who among `people` already has a TEMPLATE message (any status but
 * FAILED — a failed attempt may be retried) logged for this broadcast,
 * judged by WhatsApp number: the conversation the row hangs off is one
 * per phone, compared on its last 10 digits the same way phoneKey /
 * findPersonByPhone do, so "+57 300…", "57300…" and "300…" all count as
 * reached. The conversation's own personId is checked too, for rows
 * whose number was later edited on the contact. */
async function alreadyMessagedInBroadcast(broadcastId: string, people: Person[]): Promise<(person: Person) => boolean> {
  if (people.length === 0) return () => false;
  const ids = people.map((p) => p.id);
  const phoneKeys = people.map((p) => phoneKey(p.phone)).filter((k): k is string => !!k);
  const rows = await db.$queryRaw<{ personId: string | null; phone: string }[]>(Prisma.sql`
    SELECT c."personId", c.phone
    FROM "WhatsAppMessage" m
    JOIN "WhatsAppConversation" c ON c.id = m."conversationId"
    WHERE m."broadcastId" = ${broadcastId}
      AND m.kind = 'TEMPLATE'::"WhatsAppMessageKind"
      AND m.status <> 'FAILED'::"WhatsAppMessageStatus"
      AND (c."personId" IN (${Prisma.join(ids)})
        OR RIGHT(REGEXP_REPLACE(c.phone, '\\D', '', 'g'), 10) IN (${Prisma.join(phoneKeys.length > 0 ? phoneKeys : ["-"])}))
  `);
  const seenIds = new Set(rows.map((r) => r.personId).filter((id): id is string => !!id));
  const seenPhones = new Set(rows.map((r) => phoneKey(r.phone)).filter((k): k is string => !!k));
  return (person) => {
    if (seenIds.has(person.id)) return true;
    const key = phoneKey(person.phone);
    return !!key && seenPhones.has(key);
  };
}

/** Re-attempts every FAILED message logged for this broadcast — for a
 * transient failure (network blip, a token that just got fixed), not a
 * way around a real rejection (an unapproved template, a revoked
 * consent — hasActiveConsent is re-checked here too, so a consent
 * revoked since the original send still blocks the retry). Skips a
 * FAILED row with no linked Person (shouldn't happen — every original
 * send resolved a real Person first — but never silently guesses one). */
export async function retryFailedMessages(
  broadcastId: string,
  opts: { categories?: WhatsAppFailureCategory[] } = {}
): Promise<{ retried: number; sent: number; failed: number; skipped: number; skippedNotRetryable: number }> {
  const broadcast = await db.whatsAppBroadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { template: true, event: true },
  });

  // Only numbers whose LATEST attempt failed (a retry that already went
  // through isn't failed any more), and only for reasons a retry can fix
  // — a dead number or a user Meta is shielding is left alone, see
  // failureCategories.ts.
  const latest = await latestMessagesFor(broadcastId);
  let skippedNotRetryable = 0;
  const retryIds: string[] = [];
  for (const row of latest) {
    if (row.status !== "FAILED") continue;
    const category = categorizeWhatsAppFailure(row.errorMessage);
    if (!WHATSAPP_FAILURE_INFO[category].retryable || (opts.categories && !opts.categories.includes(category))) {
      skippedNotRetryable++;
      continue;
    }
    retryIds.push(row.messageId);
  }
  const failedMessages = retryIds.length
    ? await db.whatsAppMessage.findMany({ where: { id: { in: retryIds } }, include: { conversation: { include: { person: true } } } })
    : [];

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

  // CONCURRENCY at a time, like the main send — a few hundred retries
  // one by one would not fit in a 60s function.
  for (let i = 0; i < failedMessages.length; i += CONCURRENCY) {
    await Promise.allSettled(
      failedMessages.slice(i, i + CONCURRENCY).map(async (msg) => {
        const person = msg.conversation.person;
        if (!person || !person.phone) {
          skipped++;
          return;
        }
        if (!(await hasActiveConsent(person.id, "WHATSAPP"))) {
          skipped++;
          return;
        }
        // Same rule as the original send: a button template needs this
        // person's own entrada (it may have been cancelled since).
        const ticketToken = tickets?.get(person.id);
        if (ticketButton && !ticketToken) {
          skipped++;
          return;
        }
        const outcome = await sendOneTemplateMessage(broadcast, person, broadcast.event, orgSettings, ticketToken);
        if (outcome === "sent") sent++;
        else failed++;
      })
    );
  }

  return { retried: failedMessages.length, sent, failed, skipped, skippedNotRetryable };
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
  /** Extra messages this broadcast put on a number it had already reached
   * (two non-FAILED rows on one conversation count as one duplicate) —
   * the honest count of what a bad resume cost. 0 is the only good value. */
  duplicates: number;
}

interface LatestMessageRow {
  messageId: string;
  conversationId: string;
  status: WhatsAppMessageStatus;
  errorMessage: string | null;
  personId: string | null;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}

/** One row per number — its LATEST TEMPLATE message for this broadcast,
 * so a number whose first attempt failed and was then retried counts
 * once, by the outcome of the retry. */
async function latestMessagesFor(broadcastId: string): Promise<LatestMessageRow[]> {
  return db.$queryRaw<LatestMessageRow[]>(Prisma.sql`
    SELECT DISTINCT ON (m."conversationId")
      m.id AS "messageId", m."conversationId", m.status, m."errorMessage",
      c."personId", c.phone, p."firstName", p."lastName"
    FROM "WhatsAppMessage" m
    JOIN "WhatsAppConversation" c ON c.id = m."conversationId"
    LEFT JOIN "Person" p ON p.id = c."personId"
    WHERE m."broadcastId" = ${broadcastId} AND m.kind = 'TEMPLATE'::"WhatsAppMessageKind"
    ORDER BY m."conversationId", m."createdAt" DESC, m.id DESC
  `);
}

export interface WhatsAppFailureGroup {
  category: WhatsAppFailureCategory;
  label: string;
  action: string;
  retryable: boolean;
  people: { personId: string | null; name: string; phone: string; detail: string | null }[];
}

/** Every number whose latest attempt for this broadcast FAILED, grouped by
 * what to do about it — biggest group first. */
export async function getBroadcastFailureBreakdown(broadcastId: string): Promise<WhatsAppFailureGroup[]> {
  const rows = await latestMessagesFor(broadcastId);
  const groups = new Map<WhatsAppFailureCategory, WhatsAppFailureGroup>();
  for (const r of rows) {
    if (r.status !== "FAILED") continue;
    const category = categorizeWhatsAppFailure(r.errorMessage);
    const group = groups.get(category) ?? { category, ...WHATSAPP_FAILURE_INFO[category], people: [] };
    group.people.push({ personId: r.personId, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—", phone: r.phone, detail: r.errorMessage });
    groups.set(category, group);
  }
  return [...groups.values()].sort((a, b) => b.people.length - a.people.length);
}

export async function getBroadcastStats(broadcastId: string): Promise<BroadcastStats> {
  // Per number, by its latest row (see latestMessagesFor).
  const latest = await latestMessagesFor(broadcastId);
  const byStatus: Partial<Record<WhatsAppMessageStatus, number>> = {};
  for (const r of latest) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const processed = latest.length;
  const perConversation = await db.whatsAppMessage.groupBy({
    by: ["conversationId"],
    where: { broadcastId, kind: "TEMPLATE", status: { not: "FAILED" } },
    _count: { _all: true },
    having: { conversationId: { _count: { gt: 1 } } },
  });
  const duplicates = perConversation.reduce((sum, r) => sum + r._count._all - 1, 0);
  return {
    processed,
    duplicates,
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
export async function sendDueWhatsAppBroadcasts(now: Date = new Date()): Promise<{ processed: number; armed: number }> {
  const { resolveDueAt, isDue } = await import("@/lib/broadcastSchedule");
  const candidates = await db.whatsAppBroadcast.findMany({
    where: { status: "QUEUED", scheduleKind: { not: "IMMEDIATE" } },
    include: { event: true },
  });
  let processed = 0;
  let armed = 0;
  for (const b of candidates) {
    const dueAt = resolveDueAt(b, b.event);
    if (!dueAt) continue;
    if (!isDue(dueAt, now)) {
      // Same nightly arming as sendDueEventBroadcasts (lib/broadcasts.ts):
      // QStash can't be asked more than QSTASH_MAX_DELAY_MS ahead.
      if (!b.qstashMessageId && dueAt.getTime() - now.getTime() <= QSTASH_MAX_DELAY_MS) {
        const qstashMessageId = await scheduleWhatsAppBroadcastSend(b.id, dueAt);
        if (qstashMessageId) {
          await db.whatsAppBroadcast.update({ where: { id: b.id }, data: { qstashMessageId } });
          armed++;
        }
      }
      continue;
    }
    try {
      await sendWhatsAppBroadcast(b.id);
      processed++;
    } catch (err) {
      console.error("sendDueWhatsAppBroadcasts: failed to send", b.id, err);
    }
  }
  return { processed, armed };
}
