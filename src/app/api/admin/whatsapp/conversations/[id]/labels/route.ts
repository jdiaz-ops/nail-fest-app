import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getOrCreateLabel } from "@/lib/labels";

const bodySchema = z.object({ name: z.string().min(1) });

// Labels live on Person, not on the conversation — see Label's own schema
// comment. A conversation whose personId is null (an inbound message
// from a number that never matched a CRM contact) has nothing to attach
// a label to yet.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const conversation = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conversation) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  if (!conversation.personId) {
    return NextResponse.json({ error: "no_linked_person", message: "Este contacto no coincide con nadie del CRM todavía." }, { status: 409 });
  }

  const label = await getOrCreateLabel(parsed.data.name);
  await db.person.update({ where: { id: conversation.personId }, data: { labels: { connect: { id: label.id } } } });
  return NextResponse.json({ ok: true, label });
}
