import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { db } from "@/lib/db";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";
import { scheduledSendCallbackUrl } from "@/lib/qstash";

// QStash's exact-time callback for a Difusión scheduled via "A una fecha
// y hora programada" — see lib/qstash.ts's own comment for why this
// exists alongside the daily /api/whatsapp/send-due cron rather than
// instead of it. Verified against QSTASH_CURRENT_SIGNING_KEY/
// QSTASH_NEXT_SIGNING_KEY the same way (raw body, before JSON.parse,
// fail closed on a missing secret) as /api/webhooks/whatsapp verifies
// Meta's own signature — not @upstash/qstash's verifySignatureAppRouter
// helper, which throws at import time when the signing keys aren't set
// yet (this route needs to exist and fail closed cleanly even before
// Upstash is configured, not break the whole module).
async function isValidSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!signature || (!currentSigningKey && !nextSigningKey)) return false;
  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  try {
    return await receiver.verify({ signature, body: rawBody, url: scheduledSendCallbackUrl() });
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await isValidSignature(rawBody, req.headers.get("upstash-signature")))) {
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
