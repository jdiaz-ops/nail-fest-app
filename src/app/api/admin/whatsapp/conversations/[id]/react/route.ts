import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { whatsappProvider } from "@/lib/whatsapp";
import { STAFF_REACTIONS, canBeReactedTo, reactionBlockedReason } from "@/lib/whatsapp/reactions";
import { categorizeWhatsAppFailure, describeWhatsAppSendError, extractMetaErrorCode } from "@/lib/whatsapp/failureCategories";

// null = take back the reaction left before.
const bodySchema = z.object({ messageId: z.string().min(1), emoji: z.enum(STAFF_REACTIONS).nullable() });

/** Why WhatsApp didn't take the reaction, for the team. */
function reactionError(errorMessage: string): string {
  // Meta's reaction-specific refusal: the message is over 30 days old,
  // was deleted, or isn't in this chat.
  if (extractMetaErrorCode(errorMessage) === 131009) return "WhatsApp no dejó reaccionar a este mensaje: puede ser muy viejo o haberse borrado.";
  if (categorizeWhatsAppFailure(errorMessage) === "unknown") return "WhatsApp no recibió la reacción. Vuelve a intentarlo en un momento.";
  return describeWhatsAppSendError(errorMessage);
}

// The team's emoji reaction to something the person wrote (Bandeja's tap
// on their message — see lib/whatsapp/reactions.ts). Same 24h window as a
// text reply, checked here so the answer comes in words instead of Meta's
// error. Never turns the AI agent off: reacting isn't answering.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { messageId, emoji } = parsed.data;

  const message = await db.whatsAppMessage.findFirst({ where: { id: messageId, conversationId: params.id }, include: { conversation: true } });
  if (!message || !canBeReactedTo(message)) return NextResponse.json({ error: "message_not_found" }, { status: 404 });
  if ((message.staffReaction ?? null) === emoji) return NextResponse.json({ ok: true, reaction: emoji });

  const blocked = reactionBlockedReason(message.createdAt, message.conversation.lastInboundAt);
  if (blocked) return NextResponse.json({ error: "cannot_react", message: blocked }, { status: 409 });

  try {
    const result = await whatsappProvider.sendReaction({ to: message.conversation.phone, messageId: message.providerMessageId!, emoji: emoji ?? "" });
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { staffReaction: emoji, staffReactionProviderId: result.providerMessageId } });
    return NextResponse.json({ ok: true, reaction: emoji });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("whatsapp inbox reaction failed", err);
    // Meta's own "the window is closed" — our clock said open (it closed
    // between page load and this tap).
    if (extractMetaErrorCode(errorMessage) === 131047) {
      return NextResponse.json({ error: "cannot_react", message: reactionBlockedReason(message.createdAt, null) }, { status: 409 });
    }
    return NextResponse.json({ error: "send_failed", message: reactionError(errorMessage) }, { status: 502 });
  }
}
