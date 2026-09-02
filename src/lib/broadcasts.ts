import { db } from "@/lib/db";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { bulkActiveConsent } from "@/lib/consent";
import { emailProvider } from "@/lib/email";
import { broadcastEmail, broadcastEmailHtml } from "@/lib/email/templates";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { getOrgSettings } from "@/lib/settings";
import { publishChunkContinuation } from "@/lib/qstash";

const CONCURRENCY = 10;
// How many recipients one chunk sends before either finishing or handing
// the rest off to QStash — see sendEventBroadcast's own comment for the
// full reasoning (same mechanism, same constant, as lib/whatsapp/
// broadcasts.ts's CHUNK_SIZE).
const CHUNK_SIZE = 500;

/** The actual send for an event-scoped broadcast ("Correos del evento")
 * — called either immediately (scheduleKind IMMEDIATE, from the
 * composer's own submit), by the cron once a scheduled broadcast's due
 * time arrives (see lib/broadcastSchedule.ts), or by a QStash chunk
 * continuation (see /api/broadcasts/process-chunk). Same real send path
 * every time, not copies that could drift.
 *
 * Sends the next chunk from wherever the broadcast's persisted cursor
 * left off, and either finishes it (status -> SENT) or hands the rest to
 * a QStash callback so a big audience never has to fit inside one
 * function invocation — the real fix for the "a background job/queue is
 * the fix before a 10k+ send" limitation this used to just flag and
 * accept (see the commit this comment shipped with). The full recipient
 * list is resolved once (the first call for this broadcast) and frozen
 * as `recipientPersonIds` — never re-resolved on a later chunk, so the
 * event's registrations changing mid-send can't skip anyone or
 * double-send to someone no longer eligible; each chunk still re-fetches
 * fresh `registration`/ticket-type DATA for its own ids (stable per
 * registration, unlike membership) rather than caching that too.
 *
 * Without QStash configured this still completes a broadcast of any
 * size — it keeps looping chunk after chunk in the same call, the exact
 * synchronous behavior this had before chunking existed (`backgrounded:
 * false` in the return value) — the risk that used to be flagged is
 * smaller now (each chunk's accounting doesn't restart) but isn't fully
 * gone without QStash, surfaced as a warning, not hidden. */
export async function sendEventBroadcast(
  broadcastId: string
): Promise<{ sent: number; skippedNoConsent: number; remaining: number; backgrounded: boolean }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, include: { event: true } });
  if (!broadcast.eventId || !broadcast.event) throw new Error("sendEventBroadcast called on a non-event broadcast");
  if (!broadcast.bodyHtml) throw new Error("sendEventBroadcast called on a broadcast with no bodyHtml");

  // First call for this broadcast: resolve the full recipient list once
  // and freeze it. A later (continuation) call reuses the frozen list.
  let recipientIds: string[];
  if (broadcast.recipientPersonIds) {
    recipientIds = broadcast.recipientPersonIds as unknown as string[];
  } else {
    const recipients = await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId);
    recipientIds = recipients.map((r) => r.person.id);
    await db.emailBroadcast.update({
      where: { id: broadcast.id },
      data: { status: "SENDING", recipientPersonIds: recipientIds },
    });
  }

  // Resolved once per chunk, only if the "adjuntar entrada" checkbox is on
  // (see EventBroadcastComposer.tsx) — recipients can hold different
  // ticket types even within "all buyers", so each PDF needs its own
  // ticketTypeName looked up by that recipient's own registration.
  const orgSettings = broadcast.attachTicketPdf ? await getOrgSettings() : null;

  let sent = 0;
  let skippedNoConsent = 0;
  let cursor = broadcast.cursor;
  let backgrounded = false;

  while (cursor < recipientIds.length) {
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    // Re-resolved every chunk (cheap — one query, not a per-recipient
    // loop) so each recipient's registration/ticket-type data is
    // current, then filtered down to just this chunk's frozen ids —
    // membership itself never grows beyond recipientIds, only the DATA
    // for it gets refreshed.
    const allRecipients = await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId);
    const byId = new Map(allRecipients.map((r) => [r.person.id, r]));
    const chunk = chunkIds.map((id) => byId.get(id)).filter((r): r is (typeof allRecipients)[number] => Boolean(r));

    const consented = await bulkActiveConsent(chunkIds, "LOGISTICS");
    const ticketTypeIds = [...new Set(chunk.map((r) => r.registration.ticketTypeId).filter((id): id is string => !!id))];
    const ticketTypeNames = ticketTypeIds.length
      ? new Map((await db.ticketType.findMany({ where: { id: { in: ticketTypeIds } } })).map((t) => [t.id, t.name]))
      : new Map<string, string>();

    for (let i = 0; i < chunk.length; i += CONCURRENCY) {
      const sub = chunk.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        sub.map(async ({ person, registration }) => {
          // LOGISTICS, not MARKETING — an event-scoped broadcast is
          // operational communication tied to this person's own
          // registration (schedule changes, venue/logistics reminders,
          // day-of info), same category as the ticket confirmation itself,
          // not a cross-event promotional send. LOGISTICS is a REQUIRED
          // consent to register at all (see lib/consent.ts's
          // REQUIRED_CONSENTS), so this check is defensive rather than a
          // real filter — it exists so a registration whose consent was
          // manually revoked from the CRM doesn't still get mailed.
          // Sending this channel gated on MARKETING consent instead used
          // to be a real bug: /api/unsubscribe's own copy already
          // promised "you'll keep receiving operational info about
          // events you register for" — that promise only holds if this
          // check is LOGISTICS.
          if (!consented.has(person.id)) {
            skippedNoConsent++;
            return;
          }
          // No unsubscribeUrl — see broadcastEmailHtml's own comment on
          // why an event broadcast doesn't offer one: LOGISTICS can't be
          // revoked while staying registered, so a "darme de baja" link
          // here would be a broken promise, not a real opt-out.
          const content = broadcastEmailHtml({ subject: broadcast.subject, bodyHtml: broadcast.bodyHtml! });
          // Same "never let a PDF problem block the whole send" reasoning
          // as sendTicketEmail.ts — a recipient with no qrToken
          // (shouldn't happen for a CONFIRMED registration, but not
          // guaranteed by the schema) just gets the broadcast without the
          // attachment rather than failing their send entirely.
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
                providerMessageId: result.providerMessageId,
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

    cursor += chunkIds.length;
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { cursor } });

    if (cursor >= recipientIds.length) break; // done — falls through to the SENT update below

    const messageId = await publishChunkContinuation("email", broadcastId);
    if (messageId) {
      backgrounded = true;
      break; // the rest continues in a later invocation, not this one
    }
    // QStash unavailable — keep going in this same call (today's
    // pre-chunking behavior), rather than leaving the broadcast stuck.
  }

  const remaining = recipientIds.length - cursor;
  if (remaining === 0) {
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  }
  return { sent, skippedNoConsent, remaining, backgrounded };
}

/** The actual send for a segment-targeted marketing broadcast (the
 * original /admin/crm/broadcasts flow — plain text, MARKETING consent,
 * an unsubscribe link) — same chunked-with-QStash-continuation mechanism
 * as sendEventBroadcast above, see its own comment for the full
 * reasoning; this is IMMEDIATE-only (no scheduling on this flow, see
 * BroadcastComposer.tsx), so the only callers are /api/broadcasts'
 * own POST handler and this file's QStash continuation. */
export async function sendSegmentEmailBroadcast(
  broadcastId: string
): Promise<{ sent: number; skippedNoConsent: number; remaining: number; backgrounded: boolean; total: number }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  if (!broadcast.segmentId) throw new Error("sendSegmentEmailBroadcast called on a broadcast with no segmentId");
  if (!broadcast.bodyText) throw new Error("sendSegmentEmailBroadcast called on a broadcast with no bodyText");

  let recipientIds: string[];
  if (broadcast.recipientPersonIds) {
    recipientIds = broadcast.recipientPersonIds as unknown as string[];
  } else {
    const segment = await db.segmentDefinition.findUniqueOrThrow({ where: { id: broadcast.segmentId } });
    const people = await resolveSegment(segment.filter as unknown as SegmentFilter);
    recipientIds = people.map((p) => p.id);
    await db.emailBroadcast.update({
      where: { id: broadcast.id },
      data: { status: "SENDING", recipientPersonIds: recipientIds },
    });
  }

  let sent = 0;
  let skippedNoConsent = 0;
  let cursor = broadcast.cursor;
  let backgrounded = false;

  while (cursor < recipientIds.length) {
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    const people = await db.person.findMany({ where: { id: { in: chunkIds } } });
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const consented = await bulkActiveConsent(chunkIds, "MARKETING");

    for (let i = 0; i < chunkIds.length; i += CONCURRENCY) {
      const sub = chunkIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        sub.map(async (personId) => {
          const person = peopleById.get(personId);
          if (!person) return; // deleted since the list was frozen
          if (!consented.has(person.id)) {
            skippedNoConsent++;
            return;
          }
          const unsubscribeUrl = buildUnsubscribeUrl(person.id);
          const content = broadcastEmail({
            firstName: person.firstName ?? "",
            subject: broadcast.subject,
            bodyText: broadcast.bodyText!,
            unsubscribeUrl,
          });
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
                providerMessageId: result.providerMessageId,
                status: "SENT",
              },
            });
            sent++;
          } catch (err) {
            await db.emailLog.create({
              data: { kind: "MARKETING", broadcastId: broadcast.id, personId: person.id, toEmail: person.email, status: "FAILED" },
            });
            console.error("broadcast send failed", person.email, err);
          }
        })
      );
    }

    cursor += chunkIds.length;
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { cursor } });

    if (cursor >= recipientIds.length) break;

    const messageId = await publishChunkContinuation("email", broadcastId);
    if (messageId) {
      backgrounded = true;
      break;
    }
  }

  const remaining = recipientIds.length - cursor;
  if (remaining === 0) {
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { status: "SENT", sentAt: new Date() } });
  }
  return { sent, skippedNoConsent, remaining, backgrounded, total: recipientIds.length };
}

/** Every QUEUED, non-immediate broadcast whose computed due time has
 * arrived — see /api/broadcasts/send-due, the cron entry point. Only
 * event-scoped broadcasts support scheduling today (see
 * BroadcastComposer.tsx's own comment — a segment broadcast is always
 * IMMEDIATE), so this only ever needs sendEventBroadcast. */
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
