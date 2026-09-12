import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendZoomLinkViaWhatsApp } from "@/lib/whatsapp/sendZoomLink";

const bodySchema = z.object({ registrationId: z.string().min(1) });

// Same 24h freeform-window rule as send-ticket's own route — a FREEFORM
// text message is still bound by Meta's rule, not exempt because it's
// short.
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
      { error: "window_closed", message: "Han pasado más de 24h desde su último mensaje — no se puede enviar un texto libre hasta que vuelva a escribir." },
      { status: 409 }
    );
  }

  // Never let one open conversation resend a stranger's link just
  // because its registrationId was guessable/passed in — same check as
  // send-ticket's own route.
  const registration = await db.registration.findUnique({ where: { id: parsed.data.registrationId } });
  if (!registration || !conversation.personId || registration.personId !== conversation.personId) {
    return NextResponse.json({ error: "registration_mismatch" }, { status: 403 });
  }

  const result = await sendZoomLinkViaWhatsApp(parsed.data.registrationId, conversation.phone);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
