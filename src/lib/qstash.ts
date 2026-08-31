import { Client } from "@upstash/qstash";

// Precise-time scheduled sends for Difusiones — see WhatsAppBroadcast.
// qstashMessageId's own schema comment for WHY this exists: the daily
// /api/whatsapp/send-due cron is a Vercel Hobby plan constraint (cron
// jobs there can only run once a day), so "programar para las 3pm" could
// otherwise go out up to ~24h late. QStash (Upstash) schedules a single
// HTTP call at (or after) an exact unix timestamp — no polling, no
// drift beyond QStash's own delivery latency (typically well under a
// minute) — and works from any host, including Vercel Hobby, since it's
// just an outbound HTTP call this app makes to a third-party API, not a
// Vercel-side cron.
//
// Requires QSTASH_TOKEN (publish/cancel), QSTASH_CURRENT_SIGNING_KEY /
// QSTASH_NEXT_SIGNING_KEY (verify the callback really came from QStash,
// not just anyone who guesses the webhook URL), AND QSTASH_URL — see
// docs/WHATSAPP_SETUP.md for how to get these from the Upstash console.
// QSTASH_URL is easy to skip since the SDK technically works without it
// in some setups, but QStash accounts are region-pinned (US or EU,
// chosen when the account was created) and the bare default endpoint
// doesn't reliably route to the right one — it can land on the other
// region's cluster depending on where the Vercel function physically
// runs, failing with `user (...) not found in this region`. Passed
// automatically by the Client constructor via the QSTASH_URL env var
// (its own default), not read here — just needs to be SET, matching
// whichever region the Upstash console shows.
//
// Every function here is best-effort: missing/invalid credentials never
// throw past this module, they return null/false so the caller falls
// back to the daily cron instead of failing the whole broadcast.

function getClient(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

/** The exact URL this app's QStash callback lives at — used both when
 * publishing (where to call back) and when verifying (what URL the
 * signature was made for). Always APP_BASE_URL, never Vercel's own
 * VERCEL_URL — that can be a preview-deployment URL that doesn't match
 * what was actually published to, which would fail signature
 * verification for no good reason. */
export function scheduledSendCallbackUrl(): string {
  return `${process.env.APP_BASE_URL || ""}/api/whatsapp/send-scheduled`;
}

/** Schedules a single exact-time call to /api/whatsapp/send-scheduled
 * for this broadcast. Returns the QStash messageId to store on the
 * broadcast (so it can be cancelled later if the broadcast is deleted
 * before it fires), or null if QStash isn't configured or the publish
 * call failed — the caller treats null as "fall back to the daily cron"
 * and surfaces a warning, never as a hard failure of the broadcast
 * itself (a scheduled send should still exist even if it'll go out
 * later than requested). */
export async function scheduleWhatsAppBroadcastSend(broadcastId: string, at: Date): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const result = await client.publishJSON({
      url: scheduledSendCallbackUrl(),
      body: { broadcastId },
      notBefore: Math.floor(at.getTime() / 1000),
    });
    return result.messageId;
  } catch (err) {
    console.error("qstash: failed to schedule whatsapp broadcast send", broadcastId, err);
    return null;
  }
}

/** Best-effort cancel of a still-pending scheduled message — called when
 * a QUEUED broadcast is deleted before it fires. Never throws: a message
 * that already fired or was never valid just can't be cancelled, which
 * is fine (the send-scheduled route is itself idempotent against a
 * broadcast that's already gone or already sent). */
export async function cancelScheduledSend(messageId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.messages.cancel(messageId).catch((err) => {
    console.error("qstash: failed to cancel scheduled message", messageId, err);
  });
}
