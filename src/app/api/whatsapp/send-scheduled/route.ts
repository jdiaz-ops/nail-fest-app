import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";
import { scheduledSendCallbackUrl, verifyQstashSignature } from "@/lib/qstash";

// QStash's exact-time callback for a Difusión scheduled via "A una fecha
// y hora programada" — see lib/qstash.ts's own comment for why this
// exists alongside the daily /api/whatsapp/send-due cron rather than
// instead of it.

// A large SENDING broadcast can now take several chunked QStash callbacks
// to finish (see sendWhatsAppBroadcast's own comment) — give each one the
// same generous budget as the chunk-continuation route itself, not the
// framework default.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), scheduledSendCallbackUrl()))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const broadcastId = body?.broadcastId as string | undefined;
  if (!broadcastId) {
    return NextResponse.json({ error: "missing_broadcastId" }, { status: 400 });
  }

  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: broadcastId } });
  // Not found (deleted before it fired) or already handled (sent by the
  // daily cron in the unlikely event both fired close together, or a
  // QStash retry after this same call already succeeded) — either way
  // that's not an error, just nothing left to do. Always 200 here:
  // returning non-2xx would make QStash retry a call with no useful work
  // behind it.
  if (!broadcast || broadcast.status !== "QUEUED") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await sendWhatsAppBroadcast(broadcastId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("send-scheduled: broadcast send failed", broadcastId, err);
    // A real failure here (not just "nothing to do") — 500 so QStash
    // retries with its own backoff, same as any other delivery failure.
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
