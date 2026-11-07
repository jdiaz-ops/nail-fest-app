import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { cancelScheduledSend } from "@/lib/qstash";

// «Anular» on a scheduled email of the event (the team, 2026-11-07): it
// won't go out to anyone, and stays on the list as «Anulado». Only while
// it's QUEUED — the same atomic guard as «Editar» ([broadcastId]/route.ts):
// if the send already started, this matches no row and says so. Its exact-
// time message is cancelled too; were that to fail, the send-scheduled
// route and the daily send-due cron only ever send a QUEUED one.
export async function POST(_req: Request, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const existing = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!existing) return NextResponse.json({ error: "broadcast_not_found", message: "Ese correo no existe." }, { status: 404 });

  const { count } = await db.emailBroadcast.updateMany({
    where: { id: existing.id, eventId: params.id, status: "QUEUED" },
    data: { status: "CANCELLED", qstashMessageId: null },
  });
  if (count === 0) {
    const message =
      existing.status === "CANCELLED" ? "Este correo ya estaba anulado." : "Este correo ya se envió o se está enviando: ya no se puede anular.";
    return NextResponse.json({ error: "not_cancellable", message }, { status: 409 });
  }
  if (existing.qstashMessageId) await cancelScheduledSend(existing.qstashMessageId);
  return NextResponse.json({ ok: true });
}
