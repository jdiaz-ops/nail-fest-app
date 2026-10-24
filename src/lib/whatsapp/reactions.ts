// Reacting with an emoji to a message the person sent — WhatsApp's own
// tap-and-hold reactions, from Bandeja (asked for on 2026-10-25: "no es
// enviar un mensaje con emoción, es reaccionar al mensaje"). The emoji
// lands on their message in their WhatsApp; nothing new shows in the chat.
// No database here: the thread pages and the route share these rules.

/** The two the team reacts with. */
export const STAFF_REACTIONS = ["❤️", "💅"] as const;
export type StaffReaction = (typeof STAFF_REACTIONS)[number];

// A reaction is a message like any other for Meta: only within the 24h
// customer service window, and only to a message from the last 30 days
// (older ones fail with 131009 — Meta's reaction-messages guide).
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** What Bandeja shows for a reaction the PERSON left (lib/whatsapp/inbox.ts
 * stores it as its own inbound message). */
export function inboundReactionBody(emoji: string | null | undefined): string {
  return emoji ? `Reaccionó ${emoji} a un mensaje` : "Quitó su reacción a un mensaje";
}

function isInboundReactionBody(body: string | null): boolean {
  return body !== null && /^(?:Reaccionó .+ a un mensaje|Quitó su reacción a un mensaje)$/u.test(body);
}

/** A message the team can ever react to: something the person sent that
 * WhatsApp knows by its id — not one of their own reactions (WhatsApp
 * doesn't react to reactions). */
export function canBeReactedTo(m: { direction: string; providerMessageId: string | null; body: string | null }): boolean {
  return m.direction === "INBOUND" && Boolean(m.providerMessageId) && !isInboundReactionBody(m.body);
}

/** Why WhatsApp won't take a reaction to this message right now, in words
 * for the team; null when it will. */
export function reactionBlockedReason(createdAt: Date, lastInboundAt: Date | null, now: Date = new Date()): string | null {
  if (now.getTime() - createdAt.getTime() > MAX_AGE_MS) return "WhatsApp no deja reaccionar a mensajes de hace más de 30 días.";
  if (!lastInboundAt || now.getTime() - lastInboundAt.getTime() >= WINDOW_MS) {
    return "Pasaron más de 24 horas desde su último mensaje: WhatsApp no deja reaccionar hasta que vuelva a escribir.";
  }
  return null;
}
