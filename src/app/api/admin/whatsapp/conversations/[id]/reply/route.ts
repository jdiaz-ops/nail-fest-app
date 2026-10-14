import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { whatsappProvider } from "@/lib/whatsapp";
import { recordOutboundMessage } from "@/lib/whatsapp/inbox";
import { describeWhatsAppSendError, extractMetaErrorCode } from "@/lib/whatsapp/failureCategories";

const bodySchema = z.object({ text: z.string().min(1) });

// A FREEFORM reply from the inbox — only legal within Meta's 24h customer
// service window (see WhatsAppMessageKind's own comment). Enforced here,
// not just left to Meta's own API error, so the admin gets a clear reason
// instead of a raw Graph API failure — this app has no queued-retry story
// for "wait until the window reopens", the same 24h constraint an inbox
// reply hits everywhere WhatsApp Business is used.
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const conversation = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });

  const withinWindow = conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS;
  if (!withinWindow) {
    return NextResponse.json(
      { error: "window_closed", message: "Han pasado más de 24h desde su último mensaje — solo se puede reabrir la conversación con una plantilla aprobada, no texto libre." },
      { status: 409 }
    );
  }

  // A real staff member is replying by hand — stop the AI agent from also
  // answering this thread going forward, same as an explicit escalation.
  // Never let it talk over someone who already jumped in.
  if (conversation.aiAutoReplyEnabled) {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { aiAutoReplyEnabled: false } });
  }

  try {
    const result = await whatsappProvider.sendFreeform({ to: conversation.phone, text: parsed.data.text });
    await recordOutboundMessage({
      phone: conversation.phone,
      kind: "FREEFORM",
      body: parsed.data.text,
      providerMessageId: result.providerMessageId,
      status: "SENT",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordOutboundMessage({
      phone: conversation.phone,
      kind: "FREEFORM",
      body: parsed.data.text,
      status: "FAILED",
      errorMessage,
    });
    console.error("whatsapp inbox reply failed", err);
    // Meta's own "the window is closed" (131047) — our clock said open
    // (a reaction counted as their last message, or the window shut
    // between page load and this click): same answer as the check above,
    // so the composer switches to the template picker.
    if (extractMetaErrorCode(errorMessage) === 131047) {
      return NextResponse.json({ error: "window_closed", message: describeWhatsAppSendError(errorMessage) }, { status: 409 });
    }
    return NextResponse.json({ error: "send_failed", message: describeWhatsAppSendError(errorMessage) }, { status: 502 });
  }
}
