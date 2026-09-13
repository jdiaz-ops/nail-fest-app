import { db } from "@/lib/db";
import type { EmailLogStatus } from "@prisma/client";
import { revokeConsent } from "@/lib/consent";

// Shared by both provider webhooks (/api/webhooks/ses's SNS-based events
// and /api/webhooks/resend's Svix-based ones) — each just maps its own
// provider-specific event shape to one of these five stages and calls
// this. Applying the event itself (find the EmailLog row by
// providerMessageId, decide whether this event actually moves the
// timeline forward) is identical either way, so it lives here once
// instead of copy-pasted per webhook route.

const STAGE_ORDER: EmailLogStatus[] = ["QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"];

export type EmailTrackingStage = "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "COMPLAINED";

const STAGE_FIELD: Record<EmailTrackingStage, "deliveredAt" | "openedAt" | "firstClickedAt" | "bouncedAt" | "complainedAt"> = {
  DELIVERED: "deliveredAt",
  OPENED: "openedAt",
  CLICKED: "firstClickedAt",
  BOUNCED: "bouncedAt",
  COMPLAINED: "complainedAt",
};

// Looks up the EmailLog by providerMessageId (a no-op, not an error, if
// unknown — a bad/duplicate webhook redelivery naming an id we don't
// have on file is expected, same reasoning as the SES route's own
// updateMany-not-update choice before this existed) and applies `stage`
// — but never lets a later-arriving event stomp one that already
// progressed further (STAGE_ORDER), and never overwrites an
// already-recorded timestamp for the same field (first occurrence wins,
// since a provider can redeliver the same event on retry).
export async function applyEmailTrackingEvent(providerMessageId: string, stage: EmailTrackingStage, at: Date = new Date()): Promise<void> {
  const existing = await db.emailLog.findFirst({ where: { providerMessageId } });
  if (!existing) return;

  const field = STAGE_FIELD[stage];
  const patch: Record<string, unknown> = { status: stage, [field]: at };

  if (STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(existing.status)) {
    delete patch.status;
  }
  if (existing[field]) {
    delete patch[field];
  }

  if (Object.keys(patch).length > 0) {
    await db.emailLog.update({ where: { id: existing.id }, data: patch });
  }

  // Reputation protection for a large/cold list (see the 49k-contact
  // reactivation campaign this was built for): a bounce or a spam
  // complaint is the strongest signal this app ever gets that an address
  // should stop receiving MARKETING email. Deliberately NOT trying to
  // tell a "hard" bounce from a "soft" one — neither provider's webhook
  // shape for that is something this app can verify from here — so this
  // reacts to any BOUNCED/COMPLAINED alike, on any kind of email (a
  // transactional confirmation that bounces is just as real a signal as
  // a broadcast that does), regardless of which provider sent it. Scoped
  // to MARKETING consent only, never LOGISTICS/WHATSAPP/ADVERTISING — a
  // dead or complaining address shouldn't silently stop a real ticket
  // delivery for an event this person actually registered for, only
  // future broadcast sends (which is exactly what bulkActiveConsent(...,
  // "MARKETING") already gates in lib/broadcasts.ts, so this alone is
  // enough to keep every future send away from them, no separate
  // suppression list needed). `onlyIfActive` keeps a chronically-bouncing
  // dead address from growing a new Consent row on every single future
  // redelivery of the same event.
  if ((stage === "BOUNCED" || stage === "COMPLAINED") && existing.personId) {
    await revokeConsent(existing.personId, "MARKETING", { onlyIfActive: true });
  }
}
