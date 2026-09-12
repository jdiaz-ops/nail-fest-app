import { scheduleAbandonedCartEmail } from "@/lib/qstash";

// Called once, right when /api/register/draft creates a BRAND NEW STARTED
// registration (never on a later draft update to the same row — see that
// route's own call site) — schedules exactly two reminder emails, no more:
// one ~15 minutes in, one ~2 hours in. Both are best-effort (silently a
// no-op if QSTASH_TOKEN isn't configured, same posture as every other
// QStash caller in this app) and both are independently idempotent at send
// time (see /api/abandoned-cart/send's own STARTED + cartEmailXSentAt
// check) — so even if this fires twice for some reason, nobody gets two
// copies of the same reminder.
export async function scheduleAbandonedCartReminders(registrationId: string): Promise<void> {
  const now = Date.now();
  await scheduleAbandonedCartEmail(registrationId, 1, new Date(now + 15 * 60_000));
  await scheduleAbandonedCartEmail(registrationId, 2, new Date(now + 2 * 60 * 60_000));
}
