import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { cancelScheduledSend } from "@/lib/qstash";

// Deletes the broadcast row and its message log (WhatChimp's own trash
// icon on a campaign row) — never touches WhatsAppTemplate or the
// segment, only this broadcast's own history. Also cancels this
// broadcast's own QStash message if it still has one pending — doubles
// as "cancel a scheduled send" for a QUEUED broadcast, since deleting it
// here is the only cancel action Difusiones has. Without this the
// scheduled call would still fire later; harmless (send-scheduled's own
// route just no-ops on a broadcast that's gone) but wasteful and
// confusing to see in QStash's logs.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: params.id }, select: { qstashMessageId: true } });
  if (broadcast?.qstashMessageId) {
    await cancelScheduledSend(broadcast.qstashMessageId);
  }

  await db.whatsAppMessage.deleteMany({ where: { broadcastId: params.id } });
  await db.whatsAppBroadcast.delete({ where: { id: params.id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}
