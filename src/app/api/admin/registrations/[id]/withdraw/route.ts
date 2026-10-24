import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { addNote } from "@/lib/whatsapp/notes";
import { WithdrawalError, restoreRegistration, withdrawRegistration } from "@/lib/registrationWithdrawal";

// "Retirar de esta edición" and its "Deshacer" (lib/registrationWithdrawal.ts).
// Tapped in a Bandeja chat, it also leaves an internal note in the thread,
// so whoever opens it next sees it was handled. Nothing is sent to them.
const bodySchema = z.object({ undo: z.boolean().optional(), conversationId: z.string().min(1).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { undo, conversationId } = parsed.data;

  try {
    const { registration, changed } = undo ? await restoreRegistration(params.id) : await withdrawRegistration(params.id, auth.user.id);
    const conversation = changed && conversationId ? await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { id: true } }) : null;
    if (conversation) {
      const event = registration.event.name;
      await addNote(
        conversation.id,
        auth.user.id,
        undo ? `Se deshizo el retiro de «${event}»: vuelve a contar para ese evento.` : `Se retiró de «${event}»: avisó que no va. Ya no le llegan mensajes de ese evento ni cuenta en sus estadísticas.`
      );
    }
    return NextResponse.json({ ok: true, state: undo ? "in" : "out" });
  } catch (err) {
    if (err instanceof WithdrawalError) {
      return NextResponse.json({ error: "cannot_withdraw", message: err.message }, { status: 409 });
    }
    throw err;
  }
}
