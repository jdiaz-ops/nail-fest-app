import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Called when the admin opens a thread (Bandeja/[id]/page.tsx) — resets
// the unread badge shown in the conversation list.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  await db.whatsAppConversation.update({ where: { id: params.id }, data: { unreadCount: 0 } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
