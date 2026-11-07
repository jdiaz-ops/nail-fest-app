import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { cancelScheduledSend } from "@/lib/qstash";

// «Detener envío» on a difusión (the team, 2026-11-07): one going out stops
// within seconds — the batch already handed to WhatsApp (up to 10
// messages) still goes —; a scheduled one won't go out. Its history stays:
// who got it, delivered, read, failed. Nothing more goes out: the send
// loop checks between batches (lib/whatsapp/broadcasts.ts), and the chunk
// continuations, the scheduled send, the daily cron, «Reanudar» and the
// automatic retries all only act on a QUEUED/SENDING/SENT one.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const existing = await db.whatsAppBroadcast.findUnique({ where: { id: params.id }, select: { id: true, status: true, qstashMessageId: true } });
  if (!existing) return NextResponse.json({ error: "not_found", message: "Esa difusión no existe." }, { status: 404 });

  const { count } = await db.whatsAppBroadcast.updateMany({
    where: { id: existing.id, status: { in: ["QUEUED", "SENDING"] } },
    data: { status: "CANCELLED", qstashMessageId: null },
  });
  if (count === 0) {
    const message = existing.status === "CANCELLED" ? "Esta difusión ya estaba detenida." : "Esta difusión ya terminó de enviarse: no hay nada que detener.";
    return NextResponse.json({ error: "not_stoppable", message }, { status: 409 });
  }
  if (existing.status === "QUEUED" && existing.qstashMessageId) await cancelScheduledSend(existing.qstashMessageId);
  return NextResponse.json({ ok: true });
}
