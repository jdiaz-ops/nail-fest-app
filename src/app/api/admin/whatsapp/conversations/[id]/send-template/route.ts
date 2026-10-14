import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { whatsappProvider } from "@/lib/whatsapp";
import { dynamicUrlButtonIndex } from "@/lib/whatsapp/automations";
import { describeWhatsAppSendError } from "@/lib/whatsapp/failureCategories";
import { recordOutboundMessage } from "@/lib/whatsapp/inbox";
import { renderTemplateBody } from "@/lib/whatsapp/templateText";

const bodySchema = z.object({ templateId: z.string().min(1), variables: z.array(z.string().max(500)).max(10) });

// One APPROVED template to one conversation, from the thread itself —
// the only way to write to someone whose 24h window is closed (see the
// reply route). A template with a dynamic URL button needs a per-person
// link this picker doesn't build (the ticket automation does), so those
// are refused here and the composer never offers them.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });

  const [conversation, template] = await Promise.all([
    db.whatsAppConversation.findUnique({ where: { id: params.id } }),
    db.whatsAppTemplate.findUnique({ where: { id: parsed.data.templateId } }),
  ]);
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  if (!template || template.status !== "APPROVED") return NextResponse.json({ error: "template_not_approved", message: "Esa plantilla no está aprobada." }, { status: 400 });
  if (dynamicUrlButtonIndex(template.buttons) >= 0) {
    return NextResponse.json({ error: "dynamic_button", message: "Esa plantilla lleva un enlace personal por persona y no se puede enviar desde aquí." }, { status: 400 });
  }
  const variables = parsed.data.variables.slice(0, template.variableCount).map((v) => v.trim());
  if (variables.length !== template.variableCount || variables.some((v) => !v)) {
    return NextResponse.json({ error: "missing_variables", message: "Faltan valores para las variables de la plantilla." }, { status: 400 });
  }

  // A human is taking over this thread, same as a typed reply.
  if (conversation.aiAutoReplyEnabled) {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { aiAutoReplyEnabled: false } });
  }

  const body = renderTemplateBody(template.bodyText, variables);
  try {
    const result = await whatsappProvider.sendTemplate({ to: conversation.phone, templateName: template.name, languageCode: template.language, variables });
    await recordOutboundMessage({ phone: conversation.phone, kind: "TEMPLATE", body, templateId: template.id, providerMessageId: result.providerMessageId, status: "SENT" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordOutboundMessage({ phone: conversation.phone, kind: "TEMPLATE", body, templateId: template.id, status: "FAILED", errorMessage });
    console.error("whatsapp inbox template send failed", err);
    return NextResponse.json({ error: "send_failed", message: describeWhatsAppSendError(errorMessage) }, { status: 502 });
  }
}
