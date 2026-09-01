import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; labelId: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const conversation = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conversation?.personId) return NextResponse.json({ error: "no_linked_person" }, { status: 409 });

  await db.person.update({ where: { id: conversation.personId }, data: { labels: { disconnect: { id: params.labelId } } } });
  return NextResponse.json({ ok: true });
}
