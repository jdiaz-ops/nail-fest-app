import { db } from "@/lib/db";
import type { WhatsAppMessageKind, WhatsAppMessageStatus } from "@prisma/client";
import { revokeConsent } from "@/lib/consent";
import { whatsappProvider } from "./index";

// Digits only — Meta's webhook payload identifies contacts by "wa_id"
// (e.g. "573001234567", no "+"), while Person.phone is stored with the
// leading "+" (see RegistrationForm.tsx's phoneCountry.dialCode+localPhone). Compare
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

// Common ways a Colombian WhatsApp contact asks to stop hearing from us —
// checked before handing a text reply to the AI agent (aiAgent.ts), since
// a deterministic keyword match is more reliable here than trusting an
// LLM to always catch this and never miss it. Phrase-based on purpose,
// not single ambiguous words ("baja" alone would false-positive on
// "necesito bajar el precio") — the one exception is a message that's
// JUST "stop", the universal SMS/WhatsApp opt-out convention. Compared
// after stripping accents (see normalizeForMatch), so the list only
// needs the unaccented spelling once.
const OPT_OUT_PHRASES = [
  "no mas mensajes",
  "no me escriban mas",
  "dejen de escribirme",
  "dejen de escribir",
  "no quiero recibir mas mensajes",
  "desuscribirme",
  "desuscribeme",
  "quitame de la lista",
  "sacame de la lista",
  "eliminame de esta lista",
];

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function isWhatsAppOptOutMessage(text: string): boolean {
  const normalized = normalizeForMatch(text);
  if (normalized === "stop" || normalized === "unsubscribe") return true;
  return OPT_OUT_PHRASES.some((phrase) => normalized.includes(phrase));
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
  // Present when type === "button" — a tap on one of a TEMPLATE message's
  // own QUICK_REPLY buttons (see WhatsAppTemplateButton). `text` is the
  // button's visible label, exactly as it was defined on the template —
  // that's what resolveAttendancePollReply below matches against.
  button?: { text: string; payload?: string };
  // Present on any reply Meta considers "in reply to" an earlier message —
  // for a button tap this is the wamid of the TEMPLATE message the button
  // lived on, which is exactly the providerMessageId recordOutboundMessage
  // stored for that send. That's the one reliable way back to which
  // broadcast/template this reply is actually about.
  context?: { id: string };
  // Present when type === "reaction" — a tap-and-hold emoji react on an
  // earlier message (ours or theirs), not a real reply. `emoji` is absent
  // when they REMOVED a reaction they'd previously left (Meta sends that
  // as its own reaction event too, with no emoji).
  reaction?: { message_id: string; emoji?: string };
}

interface WebhookStatus {
  id: string; // wamid this status is about
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  // Present on a "failed" status — Meta's own error code/title for why.
  // Only populated for `failed`; every other status omits it.
  errors?: { code: number; title: string; message?: string }[];
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
  const body =
    msg.type === "text"
      ? msg.text?.body ?? null
      : msg.type === "button"
        ? msg.button?.text ?? null
        : msg.type === "reaction"
          ? msg.reaction?.emoji
            ? `Reaccionó ${msg.reaction.emoji} a un mensaje`
            : "Quitó su reacción a un mensaje"
          : `[mensaje tipo ${msg.type}, no soportado aún]`;

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
    // A reaction was cluttering "No leídos" with things that never
    // actually need a reply — see this function's own body-building
    // above. Still shows up in the conversation (lastInboundAt), just
    // doesn't count toward the badge that says "you owe someone a
    // response". Every other type (including a sticker — that CAN be
    // someone's whole answer to something, unlike a reaction) still
    // counts, same as before.
    data: {
      lastInboundAt: new Date(),
      ...(msg.type === "reaction" ? {} : { unreadCount: { increment: 1 } }),
    },
  });

  // A tap on the attendance-poll template's own Sí/No buttons — see
  // resolveAttendancePollReply's own comment for the full chain back to a
  // registration. Never touches the LLM agent path below (this is a
  // button, not free text it could reply to) and never throws past this
  // point — same "log everything, never break the webhook's 200" posture
  // as the rest of this file.
  if (msg.type === "button" && msg.button && msg.context?.id) {
    await resolveAttendancePollReply(conversation.personId, msg.context.id, msg.button.text).catch((err) =>
      console.error("whatsapp webhook: attendance poll reply failed", err)
    );
  }

  // A deterministic "stop writing to me" catch, checked BEFORE the AI
  // agent — same posture as email's one-click unsubscribe (revokeConsent,
  // lib/consent.ts), just triggered by a keyword instead of a link tap.
  // Revokes WHATSAPP consent (never MARKETING/ADVERTISING/LOGISTICS —
  // this is specifically "stop messaging me on WhatsApp") so every future
  // WhatsAppBroadcast — already gated the same way email Difusiones are —
  // skips this person automatically from here on. Only when the number
  // resolves to a known Person; an unmatched number has no consent row to
  // revoke, and the confirmation reply below still sends regardless
  // (there's no CRM profile to update, but the person still asked to stop
  // and deserves to hear that it worked). Short-circuits the AI agent
  // entirely for this message — a fixed, predictable confirmation instead
  // of trusting the LLM to always recognize an opt-out the same way.
  if (msg.type === "text" && body && isWhatsAppOptOutMessage(body)) {
    if (conversation.personId) {
      await revokeConsent(conversation.personId, "WHATSAPP").catch((err) =>
        console.error("whatsapp webhook: opt-out consent revoke failed", err)
      );
    }
    const confirmationText = "Listo, no te vamos a volver a escribir por aquí. Si cambias de opinión, puedes registrarte de nuevo a un evento cuando quieras.";
    await whatsappProvider
      .sendFreeform({ to: phone, text: confirmationText })
      .then((result) =>
        recordOutboundMessage({
          phone,
          kind: "FREEFORM",
          body: confirmationText,
          providerMessageId: result.providerMessageId,
          status: "SENT",
        })
      )
      .catch((err) => console.error("whatsapp webhook: opt-out confirmation send failed", err));
    return;
  }

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

// Some 2-3 words at most ("Sí voy", "Sí, voy", "No puedo") is all this
// template asks for, so a simple case-insensitive "starts with sí/si" is
// enough to tell CONFIRMED from DECLINED without needing to store which of
// the template's own buttons was which — matches the actual ask ("vienes
// este fin de semana, sí/no"), not a general free-text intent parser.
function classifyAttendanceReply(buttonText: string): "CONFIRMED" | "DECLINED" {
  return /^s[ií]\b/i.test(buttonText.trim()) ? "CONFIRMED" : "DECLINED";
}

/** Resolves one quick-reply button tap back to a Registration and records
 * its attendance intent — only when the tap traces back (via Meta's own
 * `context.id`, the wamid of the template message the button lived on) to
 * an outbound broadcast send whose template is flagged isAttendancePoll
 * (see that field's own schema comment). Every other quick-reply template
 * — or a reply Meta didn't attach a context to — falls through as a no-op;
 * the plain inbound message this reply already got logged as (above) is
 * all that happens for those, unchanged from before this existed. */
async function resolveAttendancePollReply(personId: string | null, contextMessageId: string, buttonText: string): Promise<void> {
  if (!personId) return; // no matched CRM contact — nothing to attach this to

  const originalMessage = await db.whatsAppMessage.findFirst({
    where: { providerMessageId: contextMessageId },
    include: { template: true, broadcast: true },
  });
  if (!originalMessage?.template?.isAttendancePoll || !originalMessage.broadcast?.eventId) return;

  const registration = await db.registration.findUnique({
    where: { personId_eventId: { personId, eventId: originalMessage.broadcast.eventId } },
  });
  if (!registration) return;

  await db.registration.update({
    where: { id: registration.id },
    data: { attendanceIntent: classifyAttendanceReply(buttonText) },
  });
}

// Meta's "Message Undeliverable" code — the number isn't reachable/valid
// on WhatsApp. Deliberately the ONLY failure code this file reacts to for
// list hygiene: most other "failed" statuses have nothing to do with the
// recipient at all — most commonly 131047 (a freeform reply attempted
// outside Meta's 24h customer-service window, routine in this app's own
// automations) — and auto-suppressing on those would silently cut off
// perfectly good numbers.
const UNDELIVERABLE_ERROR_CODE = 131026;

async function handleStatusUpdate(status: WebhookStatus): Promise<void> {
  const mapped = STATUS_MAP[status.status];
  if (!mapped) return;

  // A plain findFirst+update, not the old updateMany — this needs the
  // row's own conversation/personId to react to a repeated undeliverable
  // failure below, which updateMany's "no rows returned" shape can't
  // give back. Still just as tolerant of "nothing matched" (a status
  // event racing our own create(), or naming a wamid from before this
  // table existed) — that's a no-op, not an error.
  const existing = await db.whatsAppMessage.findFirst({
    where: { providerMessageId: status.id },
    select: { id: true, conversationId: true, conversation: { select: { personId: true } } },
  });
  if (!existing) return;

  const firstError = status.errors?.[0];
  const data: { status: WhatsAppMessageStatus; deliveredAt?: Date; readAt?: Date; errorMessage?: string } = { status: mapped };
  if (mapped === "DELIVERED") data.deliveredAt = new Date();
  if (mapped === "READ") data.readAt = new Date();
  if (mapped === "FAILED" && firstError) {
    // Code kept in the stored string (not just the human title) so the
    // repeated-failure count below can match on it specifically, without
    // a dedicated column just for this.
    data.errorMessage = `[${firstError.code}] ${firstError.title}${firstError.message ? ` — ${firstError.message}` : ""}`;
  }
  await db.whatsAppMessage.update({ where: { id: existing.id }, data });

  if (mapped === "FAILED" && firstError?.code === UNDELIVERABLE_ERROR_CODE && existing.conversation.personId) {
    const personId = existing.conversation.personId;
    // Conservative on purpose — even this one specific code could in
    // principle be a one-off transient issue, so this only acts once the
    // SAME conversation has hit it twice, same "repeated soft bounce ==
    // functionally dead" reasoning as email (lib/email/tracking.ts's own
    // comment). onlyIfActive keeps a chronically-undeliverable number
    // from growing a new Consent row on every future attempt.
    const priorFailures = await db.whatsAppMessage.count({
      where: { conversationId: existing.conversationId, status: "FAILED", errorMessage: { startsWith: `[${UNDELIVERABLE_ERROR_CODE}]` } },
    });
    if (priorFailures >= 2) {
      await revokeConsent(personId, "WHATSAPP", { onlyIfActive: true }).catch((err) =>
        console.error("whatsapp webhook: undeliverable consent revoke failed", err)
      );
    }
  }
}
