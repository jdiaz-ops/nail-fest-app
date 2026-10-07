import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEventBroadcast } from "@/lib/broadcasts";
import { scheduledEmailSendCallbackUrl, verifyQstashSignature } from "@/lib/qstash";

// QStash's exact-time callback for an event EMAIL broadcast — the email
// twin of /api/whatsapp/send-scheduled (see that route's own comment).
// Scheduled when the broadcast is created/edited (see
// /api/admin/events/[id]/broadcasts and lib/qstash.ts's
// scheduleEventBroadcastSend); the daily /api/broadcasts/send-due cron
// stays as the fallback and is idempotent against anything sent here.
//
// Same chunked send path as everywhere else: the first chunk goes out in
// this call, the rest through QStash continuations (process-chunk).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), scheduledEmailSendCallbackUrl()))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  const body = JSON.parse(rawBody || "{}");
  const broadcastId = body?.broadcastId as string | undefined;
  if (!broadcastId) {
    return NextResponse.json({ error: "missing_broadcastId" }, { status: 400 });
  }
  const broadcast = await db.emailBroadcast.findUnique({ where: { id: broadcastId } });
  // Deleted before it fired, already sent (cron, or a QStash retry after a
  // successful call), or not an event broadcast — nothing to do. Always
  // 200: a non-2xx would only make QStash retry a call with no work behind it.
  if (!broadcast || broadcast.status !== "QUEUED" || !broadcast.eventId) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  try {
    const result = await sendEventBroadcast(broadcastId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("send-scheduled (email): broadcast send failed", broadcastId, err);
    // A real failure — 500 so QStash retries with its own backoff.
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
