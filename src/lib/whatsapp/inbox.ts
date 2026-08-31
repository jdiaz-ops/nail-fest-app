import { db } from "@/lib/db";
import type { WhatsAppMessageKind, WhatsAppMessageStatus } from "@prisma/client";

// Digits only — Meta's webhook payload identifies contacts by "wa_id"
// (e.g. "573001234567", no "+"), while Person.phone is stored with the
// leading "+" (see RegistrationForm.tsx's countryCode+localPhone). Compare
// on digits only everywhere in this file instead of requiring an exact
// string match either direction.
function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/** Best-effort match to an existing CRM contact by phone — a real
 * inbound message from a number that doesn't match any known Person is
 * NOT an error, just a conversation with personId left null (see
 * WhatsAppConversation's own comment); matched on the last 10 digits so a
 * stored "+573001234567" matches an incoming "573001234567" or vice
 * versa regardless of which one (if either) carries the country code. */
async function findPersonByPhone(phone: string) {
  const digits = digitsOnly(phone);
  const last10 = digits.slice(-10);
  if (last10.length < 7) return null; // too short to safely match on
  return db.person.findFirst({ where: { phone: { endsWith: last10 } } });
}

/** One conversation per phone number, created on first contact either
 * direction (an inbound message, or the first outbound broadcast/reply to
 * a number with no prior thread) — upsert by the unique `phone` so this
 * is safe to call from both the webhook handler and the broadcast sender
 * without a race creating duplicates. */
export async function getOrCreateConversation(phone: string) {
  const existing = await db.whatsAppConversation.findUnique({ where: { phone } });
  if (existing) {
    // A conversation created from an outbound send before the person had
    // ever messaged in might have been created with personId null even
    // though a match exists now (e.g. they registered after); re-check
    // and backfill rather than leaving it orphaned forever.
    if (!existing.personId) {
      const match = await findPersonByPhone(phone);
      if (match) {
        return db.whatsAppConversation.update({ where: { id: existing.id }, data: { personId: match.id } });
      }
    }
    return existing;
  }
  const match = await findPersonByPhone(phone);
  return db.whatsAppConversation.create({ data: { phone, personId: match?.id ?? null } });
}

/** Logs one outbound send (template broadcast or inbox freeform reply) —
 * called right after the provider call succeeds or fails, same "log every
 * attempt" posture as EmailLog. */
export async function recordOutboundMessage(input: {
  phone: string;
  kind: WhatsAppMessageKind;
  body: string | null;
  broadcastId?: string | null;
  templateId?: string | null;
  providerMessageId?: string | null;
  status: WhatsAppMessageStatus;
  errorMessage?: string | null;
  /** True for a reply the LLM agent wrote (lib/whatsapp/aiAgent.ts) — see
   * WhatsAppMessage.generatedByAi's own schema comment. Every other
   * caller (broadcasts, human replies) leaves this at its default. */
  generatedByAi?: boolean;
}) {
  const conversation = await getOrCreateConversation(input.phone);
  await db.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      kind: input.kind,
      broadcastId: input.broadcastId ?? null,
      templateId: input.templateId ?? null,
      body: input.body,
      providerMessageId: input.providerMessageId ?? null,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      generatedByAi: input.generatedByAi ?? false,
      sentAt: input.status === "SENT" || input.status === "DELIVERED" || input.status === "READ" ? new Date() : null,
    },
  });
  if (input.status !== "FAILED") {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastOutboundAt: new Date() } });
  }
}

// --- Inbound webhook processing --------------------------------------

// Shapes lifted from Meta's own Cloud API webhook reference
// (developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components) —
// only the fields this app actually reads, not the full payload.
interface WebhookMessage {
  from: string; // wa_id, digits only
  id: string; // wamid — becomes providerMessageId
  timestamp: string; // unix seconds, as a string
  type: string;
  text?: { body: string };
}

interface WebhookStatus {
  id: string; // wamid this status is about
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
}

interface WebhookValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

interface WebhookPayload {
  entry?: { changes?: { value?: WebhookValue }[] }[];
}

const STATUS_MAP: Record<WebhookStatus["status"], WhatsAppMessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/** Entry point for POST /api/webhooks/whatsapp — handles both directions
 * Meta pushes through the same webhook: new inbound messages, and
 * delivery-status updates for messages we sent. Never throws on a
 * malformed/unexpected payload shape — a webhook has to return 200 to
 * whatever Meta sends or Meta backs off and eventually disables it. */
export async function processWebhookPayload(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const msg of value.messages ?? []) {
        await handleInboundMessage(msg).catch((err) => console.error("whatsapp webhook: inbound message failed", err));
      }
      for (const status of value.statuses ?? []) {
        await handleStatusUpdate(status).catch((err) => console.error("whatsapp webhook: status update failed", err));
      }
    }
  }
}

async function handleInboundMessage(msg: WebhookMessage): Promise<void> {
  const phone = `+${digitsOnly(msg.from)}`;
  const conversation = await getOrCreateConversation(phone);
  const body = msg.type === "text" ? msg.text?.body ?? null : `[mensaje tipo ${msg.type}, no soportado aún]`;

  await db.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      kind: "INBOUND",
      body,
      providerMessageId: msg.id,
      status: "DELIVERED",
    },
  });
  await db.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { lastInboundAt: new Date(), unreadCount: { increment: 1 } },
  });

  // The LLM agent (lib/whatsapp/aiAgent.ts) — only for real text messages
  // it can actually read, and only while this thread hasn't been escalated
  // to a human (respondWithAi re-checks aiAutoReplyEnabled itself too,
  // this is just the trigger point). Awaited, not fire-and-forget: the
  // webhook route's own maxDuration is raised specifically so a real
  // Claude round trip fits inside one request/response cycle instead of
  // orphaning work after Meta's already gotten its 200. Wrapped in its
  // own try/catch on top of respondWithAi's internal one — a failure
  // here must never stop the webhook from returning 200 to Meta, or Meta
  // backs off and eventually disables the whole subscription.
  if (msg.type === "text" && body) {
    // Dynamic import, not a top-level one: aiAgent.ts itself imports
    // recordOutboundMessage from this file, so a static import here would
    // be a circular dependency between the two modules.
    const { respondWithAi } = await import("./aiAgent");
    await respondWithAi(conversation.id).catch((err) => console.error("whatsapp webhook: ai agent failed", err));
  }
}

async function handleStatusUpdate(status: WebhookStatus): Promise<void> {
  const mapped = STATUS_MAP[status.status];
  if (!mapped) return;
  const data: { status: WhatsAppMessageStatus; deliveredAt?: Date; readAt?: Date } = { status: mapped };
  if (mapped === "DELIVERED") data.deliveredAt = new Date();
  if (mapped === "READ") data.readAt = new Date();
  // updateMany, not update: a status event can arrive before our own
  // create() finishes writing the row in a very tight race, or reference
  // a wamid we never logged at all (e.g. from before this table existed)
  // — either way, "nothing matched" is fine to ignore, not an error.
  await db.whatsAppMessage.updateMany({ where: { providerMessageId: status.id }, data });
}
