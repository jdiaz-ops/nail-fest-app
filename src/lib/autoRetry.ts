// Automatic retries after a send completes — the admin never has to come
// back and press "Reintentar recuperables" for the ordinary case.
//
// When a difusión / correo finishes, the send loop schedules attempt 1
// through QStash (lib/qstash.ts's scheduleAutoRetry). Each attempt retries
// only the failure groups listed here (lib/*/failureCategories.ts), bumps
// autoRetryCount, schedules the next attempt if there is one, and emails
// the admins a report of how the send really went (attempt 1 always; later
// attempts only when they actually retried someone). Two attempts, then
// it stops — anything still failing after that needs a human.

import { db } from "@/lib/db";
import { scheduleAutoRetry, AUTO_RETRY_DELAYS_SECONDS } from "@/lib/qstash";
import { retryFailedMessages } from "@/lib/whatsapp/broadcasts";
import { retryFailedEmailBroadcast } from "@/lib/broadcasts";
import type { WhatsAppFailureCategory } from "@/lib/whatsapp/failureCategories";
import type { EmailFailureCategory } from "@/lib/email/failureCategories";
import { sendSendReport } from "@/lib/sendReport";

export type AutoRetryChannel = "whatsapp" | "email";

export const MAX_AUTO_RETRIES = 2;

// Attempt 1 (30 min later): the blips. Attempt 2 (hours/a day later):
// also the full inboxes, which need time, not a second try five minutes on.
const WHATSAPP_CATEGORIES: Record<number, WhatsAppFailureCategory[]> = { 1: ["transient", "unknown"], 2: ["transient", "unknown"] };
const EMAIL_CATEGORIES: Record<number, EmailFailureCategory[]> = { 1: ["transient", "unknown"], 2: ["mailbox", "transient", "unknown"] };

export interface AutoRetryOutcome {
  attempt: number;
  retried: number;
  sent: number | null; // null for email — its retry runs chunked, results land in the stats later
  skipped: boolean;
  nextInSeconds: number | null;
}

export async function runAutoRetry(channel: AutoRetryChannel, broadcastId: string): Promise<AutoRetryOutcome | null> {
  const broadcast =
    channel === "whatsapp"
      ? await db.whatsAppBroadcast.findUnique({ where: { id: broadcastId }, select: { status: true, autoRetryCount: true, lockedUntil: true } })
      : await db.emailBroadcast.findUnique({ where: { id: broadcastId }, select: { status: true, autoRetryCount: true, lockedUntil: true } });
  if (!broadcast) return null;
  const attempt = broadcast.autoRetryCount + 1;
  if (attempt > MAX_AUTO_RETRIES) return null;
  // Still sending (a slow send, or a manual retry in flight): try again in
  // a few minutes rather than racing it.
  if (broadcast.status !== "SENT" || (broadcast.lockedUntil && broadcast.lockedUntil > new Date())) {
    await scheduleAutoRetry(channel, broadcastId, 5 * 60);
    return { attempt, retried: 0, sent: null, skipped: true, nextInSeconds: 5 * 60 };
  }

  let retried = 0;
  let sent: number | null = null;
  if (channel === "whatsapp") {
    const r = await retryFailedMessages(broadcastId, { categories: WHATSAPP_CATEGORIES[attempt] ?? [] });
    retried = r.retried;
    sent = r.sent;
    await db.whatsAppBroadcast.update({ where: { id: broadcastId }, data: { autoRetryCount: attempt } });
  } else {
    // Bump first: the retry flips the broadcast to SENDING and finishes
    // through QStash continuations, so there is no "after" to write in.
    await db.emailBroadcast.update({ where: { id: broadcastId }, data: { autoRetryCount: attempt } });
    const r = await retryFailedEmailBroadcast(broadcastId, { categories: EMAIL_CATEGORIES[attempt] ?? [] });
    retried = r.retryable;
  }

  const nextInSeconds = attempt < MAX_AUTO_RETRIES ? AUTO_RETRY_DELAYS_SECONDS[channel][attempt + 1] ?? null : null;
  if (nextInSeconds) await scheduleAutoRetry(channel, broadcastId, nextInSeconds);

  const outcome: AutoRetryOutcome = { attempt, retried, sent, skipped: false, nextInSeconds };
  if (attempt === 1 || retried > 0) {
    await sendSendReport(channel, broadcastId, outcome).catch((err) => console.error("auto-retry: report failed", channel, broadcastId, err));
  }
  return outcome;
}
