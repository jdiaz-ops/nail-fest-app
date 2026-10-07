import { db } from "@/lib/db";
import { Prisma, type EmailLogStatus } from "@prisma/client";
import { categorizeEmailFailure, EMAIL_FAILURE_INFO, type EmailFailureCategory } from "@/lib/email/failureCategories";
import { resolveEventBroadcastRecipients } from "@/lib/broadcastRecipients";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { bulkActiveConsent } from "@/lib/consent";
import { emailProvider } from "@/lib/email";
import { broadcastEmail, broadcastEmailHtml } from "@/lib/email/templates";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { confirmationCodeFor } from "@/lib/ticket";
import { getOrgSettings } from "@/lib/settings";
import { publishChunkContinuation, scheduleEventBroadcastSend, scheduleAutoRetry, AUTO_RETRY_DELAYS_SECONDS, QSTASH_MAX_DELAY_MS, CHUNK_WATCHDOG_SECONDS, CHUNK_LOCK_SECONDS } from "@/lib/qstash";
import { markEmailInvalid } from "@/lib/contactHygiene";
import { tagOwnLinksInHtml, tagOwnLinksInText, slugifyForCampaign } from "@/lib/outboundLinkTagging";
import { publicEventName } from "@/lib/eventDisplayName";

const CONCURRENCY = 10;
// How many recipients one chunk sends before either finishing or handing
// the rest off to QStash — see sendEventBroadcast's own comment for the
// full reasoning (same mechanism, same constant, as lib/whatsapp/
// broadcasts.ts's CHUNK_SIZE).
// 100, not 500: a chunk has to finish well inside Vercel's 60s function
// cap (observed ~5 recipients/s with PDF + DB writes), or the invocation
// dies mid-chunk — see the watchdog below for the safety net.
const CHUNK_SIZE = 100;

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
): Promise<{ sent: number; skippedNoConsent: number; remaining: number; backgrounded: boolean; locked: boolean }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, include: { event: true } });
  if (!broadcast.eventId || !broadcast.event) throw new Error("sendEventBroadcast called on a non-event broadcast");
  if (!broadcast.bodyHtml) throw new Error("sendEventBroadcast called on a broadcast with no bodyHtml");

  // First call for this broadcast: resolve the full recipient list once
  // and freeze it. A later (continuation) call reuses the frozen list.
  // A retry pass (retryFailedEmailBroadcast) walks only the people being
  // retried — see EmailBroadcast.retryPersonIds's own schema comment.
  const retryPass = Array.isArray(broadcast.retryPersonIds);
  let recipientIds: string[];
  if (retryPass) {
    recipientIds = broadcast.retryPersonIds as unknown as string[];
  } else if (broadcast.recipientPersonIds) {
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
    // One invocation at a time — same claim as sendWhatsAppBroadcast's,
    // see its comment. The loser leaves without sending.
    const claimed = await db.emailBroadcast.updateMany({
      where: { id: broadcastId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
      data: { lockedUntil: new Date(Date.now() + CHUNK_LOCK_SECONDS * 1000) },
    });
    if (claimed.count === 0) {
      return { sent, skippedNoConsent, remaining: recipientIds.length - cursor, backgrounded: true, locked: true };
    }
    const current = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, select: { cursor: true } });
    if (current.cursor !== cursor) {
      cursor = current.cursor;
      if (cursor >= recipientIds.length) break;
    }
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    await publishChunkContinuation("email", broadcastId, { delaySeconds: CHUNK_WATCHDOG_SECONDS, expectCursor: cursor });
    // Anyone in this chunk who already has a log row for this broadcast
    // was handled by an earlier invocation that died before advancing the
    // cursor — never email them twice.
    const alreadyLogged = await alreadyHandledInBroadcast(broadcast.id, chunkIds);
    // Re-resolved every chunk (cheap — one query, not a per-recipient
    // loop) so each recipient's registration/ticket-type data is
    // current, then filtered down to just this chunk's frozen ids —
    // membership itself never grows beyond recipientIds, only the DATA
    // for it gets refreshed.
    const allRecipients = await resolveEventBroadcastRecipients(broadcast.eventId, broadcast.ticketTypeId);
    const byId = new Map(allRecipients.map((r) => [r.person.id, r]));
    const chunk = chunkIds
      .filter((id) => !alreadyLogged.has(id))
      .map((id) => byId.get(id))
      .filter((r): r is (typeof allRecipients)[number] => Boolean(r));

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
          // Auto-tag any link back to the app's own site inside the
          // admin-authored body BEFORE it's wrapped into the full email —
          // see outboundLinkTagging.ts's own comment. Tagging the raw
          // bodyHtml here, not the fully-assembled content.html below,
          // is deliberate: broadcastEmailHtml also appends a system
          // footer (nothing for an event broadcast — see its own comment
          // on why — but the segment path below does add one), and that
          // kind of link was never meant to carry campaign attribution.
          const utmParams = { source: "email", medium: "broadcast_evento", campaign: slugifyForCampaign(broadcast.subject) };
          const taggedBodyHtml = tagOwnLinksInHtml(broadcast.bodyHtml!, utmParams);
          // The ONE merge tag this composer supports today (see
          // EventBroadcastComposer.tsx's own "Insertar link de Zoom"
          // button) — an admin-timed, opt-in alternative to the automatic
          // ZOOM_ACCESS_REMINDER, e.g. for a same-day "ya estamos en
          // vivo" email. Empty string when this registrant has no
          // zoomJoinUrl yet (event isn't virtual/hybrid, or Zoom
          // registration hasn't succeeded) — same "nothing to substitute"
          // fallback as every other merge tag in this app.
          const personalizedBodyHtml = taggedBodyHtml.split("{{ZOOM_LINK}}").join(registration.zoomJoinUrl ?? "");
          const content = broadcastEmailHtml({ subject: broadcast.subject, bodyHtml: personalizedBodyHtml });
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
                  eventName: publicEventName(broadcast.event!),
                  venueName: broadcast.event!.venueName ?? undefined,
                  venueAddress: broadcast.event!.venueAddress ?? undefined,
                  startsAt: broadcast.event!.startsAt,
                  endsAt: broadcast.event!.endsAt ?? undefined,
                  ticketTypeName: registration.ticketTypeId ? ticketTypeNames.get(registration.ticketTypeId) : undefined,
                  ticketCount: registration.ticketCount,
                  confirmationCode: confirmationCodeFor(registration.id),
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
              data: { kind: "TRANSACTIONAL", broadcastId: broadcast.id, personId: person.id, toEmail: person.email, status: "FAILED", errorMessage: errorText(err) },
            });
            await reactToRefusal(person.id, errorText(err));
            console.error("event broadcast send failed", person.email, err);
          }
        })
      );
    }

    cursor += chunkIds.length;
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { cursor, lockedUntil: null } });

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
    await finishEmailBroadcast(broadcast.id, retryPass);
  }
  return { sent, skippedNoConsent, remaining, backgrounded, locked: false };
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
): Promise<{ sent: number; skippedNoConsent: number; remaining: number; backgrounded: boolean; locked: boolean; total: number }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  if (!broadcast.segmentId) throw new Error("sendSegmentEmailBroadcast called on a broadcast with no segmentId");
  if (!broadcast.bodyText) throw new Error("sendSegmentEmailBroadcast called on a broadcast with no bodyText");

  const retryPass = Array.isArray(broadcast.retryPersonIds);
  let recipientIds: string[];
  if (retryPass) {
    recipientIds = broadcast.retryPersonIds as unknown as string[];
  } else if (broadcast.recipientPersonIds) {
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
    // One invocation at a time — same claim as sendWhatsAppBroadcast's,
    // see its comment. The loser leaves without sending.
    const claimed = await db.emailBroadcast.updateMany({
      where: { id: broadcastId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
      data: { lockedUntil: new Date(Date.now() + CHUNK_LOCK_SECONDS * 1000) },
    });
    if (claimed.count === 0) {
      return { sent, skippedNoConsent, remaining: recipientIds.length - cursor, backgrounded: true, locked: true, total: recipientIds.length };
    }
    const current = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId }, select: { cursor: true } });
    if (current.cursor !== cursor) {
      cursor = current.cursor;
      if (cursor >= recipientIds.length) break;
    }
    const chunkIds = recipientIds.slice(cursor, cursor + CHUNK_SIZE);
    await publishChunkContinuation("email", broadcastId, { delaySeconds: CHUNK_WATCHDOG_SECONDS, expectCursor: cursor });
    // Same resume guard as sendEventBroadcast: anyone already logged for
    // this broadcast was reached by an invocation that died mid-chunk.
    const alreadyLogged = await alreadyHandledInBroadcast(broadcast.id, chunkIds);
    const people = await db.person.findMany({ where: { id: { in: chunkIds } } });
    const peopleById = new Map(people.map((p) => [p.id, p]));
    const consented = await bulkActiveConsent(chunkIds, "MARKETING");

    for (let i = 0; i < chunkIds.length; i += CONCURRENCY) {
      const sub = chunkIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        sub.map(async (personId) => {
          if (alreadyLogged.has(personId)) return;
          const person = peopleById.get(personId);
          if (!person) return; // deleted since the list was frozen
          if (!consented.has(person.id)) {
            skippedNoConsent++;
            return;
          }
          const unsubscribeUrl = buildUnsubscribeUrl(person.id);
          // Same reasoning as sendEventBroadcast's own comment — tag the
          // admin-authored bodyText before it's wrapped with the
          // unsubscribe footer, not the fully-assembled output, so the
          // unsubscribe link itself never picks up a campaign tag.
          const utmParams = { source: "email", medium: "broadcast_marketing", campaign: slugifyForCampaign(broadcast.subject) };
          const taggedBodyText = tagOwnLinksInText(broadcast.bodyText!, utmParams);
          const content = broadcastEmail({
            firstName: person.firstName ?? "",
            subject: broadcast.subject,
            bodyText: taggedBodyText,
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
              data: { kind: "MARKETING", broadcastId: broadcast.id, personId: person.id, toEmail: person.email, status: "FAILED", errorMessage: errorText(err) },
            });
            await reactToRefusal(person.id, errorText(err));
            console.error("broadcast send failed", person.email, err);
          }
        })
      );
    }

    cursor += chunkIds.length;
    await db.emailBroadcast.update({ where: { id: broadcast.id }, data: { cursor, lockedUntil: null } });

    if (cursor >= recipientIds.length) break;

    const messageId = await publishChunkContinuation("email", broadcastId);
    if (messageId) {
      backgrounded = true;
      break;
    }
  }

  const remaining = recipientIds.length - cursor;
  if (remaining === 0) {
    await finishEmailBroadcast(broadcast.id, retryPass);
  }
  return { sent, skippedNoConsent, remaining, backgrounded, locked: false, total: recipientIds.length };
}

/** Delivery breakdown for one broadcast's history row — same idea as
 * lib/whatsapp/broadcasts.ts's own getBroadcastStats (Processed/
 * Delivered/Read/Failed), adapted to email's own richer event set.
 * Unlike the WhatsApp version, this reads straight off EmailLog's
 * per-event TIMESTAMP columns (deliveredAt/openedAt/…), not off the
 * `status` "furthest stage" field — see tracking.ts's own comment on
 * why the timestamps are the real source of truth: a message that was
 * later marked COMPLAINED (spam) still really was delivered and opened
 * before that, and counting by status alone would silently drop it out
 * of "delivered"/"opened". Populated by whichever provider's webhook is
 * actually wired up (docs/SES_EVENT_TRACKING.md /
 * docs/RESEND_SETUP.md) — everything but `attempted`/`sent`/`failed`
 * stays 0 until that webhook exists, same as EmailLog.status did
 * before it existed.
 *
 * `sent` (attempted minus FAILED) is the honest denominator for rates —
 * `attempted` on its own over-counts by including sends that never
 * reached the provider at all (see sendEventBroadcast's own per-
 * recipient try/catch, which logs a FAILED row with no timestamps on
 * a provider error). */
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

/** The provider refused the address itself (not a blip): label the
 * contact now — lib/contactHygiene.ts. Never throws. */
async function reactToRefusal(personId: string, errorMessage: string): Promise<void> {
  try {
    if (categorizeEmailFailure("FAILED", errorMessage) === "address") await markEmailInvalid(personId);
  } catch (err) {
    console.error("email broadcast: hygiene reaction failed", personId, err);
  }
}

/** The last chunk is through: mark SENT, drop the lock and any retry
 * list, and — for the original pass only — book the automatic retry
 * (lib/autoRetry.ts). sentAt stays the ORIGINAL send's time. */
async function finishEmailBroadcast(broadcastId: string, retryPass: boolean): Promise<void> {
  await db.emailBroadcast.update({
    where: { id: broadcastId },
    data: { status: "SENT", lockedUntil: null, retryPersonIds: Prisma.DbNull, ...(retryPass ? {} : { sentAt: new Date() }) },
  });
  if (!retryPass) await scheduleAutoRetry("email", broadcastId, AUTO_RETRY_DELAYS_SECONDS.email[1]!);
}

/** The people in `personIds` this broadcast already handled — anyone with
 * a log row, EXCEPT a FAILED row whose reason is retryable (a provider
 * rate limit, a blip): those get another attempt when the send is resumed
 * or "Reintentar recuperables" re-walks the list. A FAILED row for a dead
 * address stays handled, so a re-walk never hammers it again. */
async function alreadyHandledInBroadcast(broadcastId: string, personIds: string[]): Promise<Set<string>> {
  const rows = await db.emailLog.findMany({
    where: { broadcastId, personId: { in: personIds } },
    select: { personId: true, status: true, errorMessage: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // Latest row per person decides.
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.personId) latest.set(r.personId, r);
  const handled = new Set<string>();
  for (const [personId, r] of latest) {
    const category = categorizeEmailFailure(r.status, r.errorMessage);
    if (category && EMAIL_FAILURE_INFO[category].retryable) continue;
    handled.add(personId);
  }
  return handled;
}

interface LatestEmailLogRow {
  personId: string | null;
  status: EmailLogStatus;
  errorMessage: string | null;
  toEmail: string;
  deliveredAt: Date | null;
  openedAt: Date | null;
  firstClickedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
}

/** One row per recipient — their LATEST log row for this broadcast, so a
 * person whose first attempt FAILED and was then retried counts once, by
 * the outcome of the retry. */
async function latestEmailLogsFor(broadcastId: string): Promise<LatestEmailLogRow[]> {
  return db.$queryRaw<LatestEmailLogRow[]>(Prisma.sql`
    SELECT DISTINCT ON (l."personId")
      l."personId", l.status, l."errorMessage", l."toEmail",
      l."deliveredAt", l."openedAt", l."firstClickedAt", l."bouncedAt", l."complainedAt",
      p."firstName", p."lastName"
    FROM "EmailLog" l
    LEFT JOIN "Person" p ON p.id = l."personId"
    WHERE l."broadcastId" = ${broadcastId}
    ORDER BY l."personId", l."createdAt" DESC, l.id DESC
  `);
}

export interface EmailFailureGroup {
  category: EmailFailureCategory;
  label: string;
  action: string;
  retryable: boolean;
  people: { personId: string | null; name: string; email: string; status: EmailLogStatus; detail: string | null }[];
}

/** Every recipient whose latest outcome for this broadcast is a failure
 * (refused before sending, bounced, or complained), grouped by what to do
 * about it — biggest group first. */
export async function getEmailBroadcastFailureBreakdown(broadcastId: string): Promise<EmailFailureGroup[]> {
  const rows = await latestEmailLogsFor(broadcastId);
  const groups = new Map<EmailFailureCategory, EmailFailureGroup>();
  for (const r of rows) {
    const category = categorizeEmailFailure(r.status, r.errorMessage);
    if (!category) continue;
    const info = EMAIL_FAILURE_INFO[category];
    const group = groups.get(category) ?? { category, ...info, people: [] };
    group.people.push({
      personId: r.personId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "—",
      email: r.toEmail,
      status: r.status,
      detail: r.errorMessage,
    });
    groups.set(category, group);
  }
  return [...groups.values()].sort((a, b) => b.people.length - a.people.length);
}

/** "Reintentar recuperables" for an event email broadcast: re-walks the
 * frozen recipient list from the top; alreadyHandledInBroadcast lets only
 * the retryable failures (see lib/email/failureCategories.ts) through, so
 * everyone else is skipped untouched. Chunked and locked exactly like the
 * original send — the broadcast reads "Enviando…" until it is through. */
export async function retryFailedEmailBroadcast(
  broadcastId: string,
  opts: { categories?: EmailFailureCategory[] } = {}
): Promise<{ retryable: number; started: boolean }> {
  const broadcast = await db.emailBroadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  if (broadcast.status !== "SENT") throw new Error("Solo se puede reintentar una difusión que ya terminó de enviarse.");
  const groups = (await getEmailBroadcastFailureBreakdown(broadcastId)).filter((g) => g.retryable && (!opts.categories || opts.categories.includes(g.category)));
  const personIds = [...new Set(groups.flatMap((g) => g.people.map((p) => p.personId)).filter((id): id is string => !!id))];
  if (personIds.length === 0) return { retryable: 0, started: false };
  await db.emailBroadcast.update({ where: { id: broadcastId }, data: { status: "SENDING", cursor: 0, retryPersonIds: personIds } });
  if (broadcast.eventId) await sendEventBroadcast(broadcastId);
  else await sendSegmentEmailBroadcast(broadcastId);
  return { retryable: personIds.length, started: true };
}

/** Kept under its old name for the admin route. */
export const retryFailedEventBroadcast = retryFailedEmailBroadcast;

export interface EmailBroadcastStats {
  attempted: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

export async function getEmailBroadcastStats(broadcastId: string): Promise<EmailBroadcastStats> {
  // Per recipient, by their latest row (see latestEmailLogsFor) — a retry
  // that succeeded moves someone out of "failed" instead of counting twice.
  const rows = await latestEmailLogsFor(broadcastId);
  const count = (pred: (r: LatestEmailLogRow) => boolean) => rows.filter(pred).length;
  const attempted = rows.length;
  const failed = count((r) => r.status === "FAILED");
  return {
    attempted,
    sent: attempted - failed,
    delivered: count((r) => !!r.deliveredAt),
    opened: count((r) => !!r.openedAt),
    clicked: count((r) => !!r.firstClickedAt),
    bounced: count((r) => !!r.bouncedAt),
    complained: count((r) => !!r.complainedAt),
    failed,
  };
}

/** Every QUEUED, non-immediate broadcast whose computed due time has
 * arrived — see /api/broadcasts/send-due, the cron entry point. Only
 * event-scoped broadcasts support scheduling today (see
 * BroadcastComposer.tsx's own comment — a segment broadcast is always
 * IMMEDIATE), so this only ever needs sendEventBroadcast. */
export async function sendDueEventBroadcasts(now: Date = new Date()): Promise<{ processed: number; armed: number }> {
  const { resolveDueAt, isDue } = await import("@/lib/broadcastSchedule");
  const candidates = await db.emailBroadcast.findMany({
    where: { status: "QUEUED", eventId: { not: null }, scheduleKind: { not: "IMMEDIATE" } },
    include: { event: true },
  });
  let processed = 0;
  let armed = 0;
  for (const b of candidates) {
    const dueAt = resolveDueAt(b, b.event);
    if (!dueAt) continue;
    if (!isDue(dueAt, now)) {
      // Not due yet: make sure it has its exact-time ticket. QStash only
      // accepts a delay up to QSTASH_MAX_DELAY_MS, so a send created
      // weeks ahead can't be armed at creation — this nightly pass arms
      // it once it comes within reach (see /api/broadcasts/send-scheduled).
      if (!b.qstashMessageId && dueAt.getTime() - now.getTime() <= QSTASH_MAX_DELAY_MS) {
        const qstashMessageId = await scheduleEventBroadcastSend(b.id, dueAt);
        if (qstashMessageId) {
          await db.emailBroadcast.update({ where: { id: b.id }, data: { qstashMessageId } });
          armed++;
        }
      }
      continue;
    }
    try {
      await sendEventBroadcast(b.id);
      processed++;
    } catch (err) {
      console.error("sendDueEventBroadcasts: failed to send", b.id, err);
    }
  }
  return { processed, armed };
}
