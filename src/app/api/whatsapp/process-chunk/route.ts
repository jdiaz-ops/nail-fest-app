import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp/broadcasts";
import { chunkContinuationCallbackUrl, verifyQstashSignature } from "@/lib/qstash";

// QStash's callback to continue a WhatsApp broadcast send from wherever
// its persisted cursor left off — see sendWhatsAppBroadcast's own comment
// for why this exists (the real fix for "a background job/queue is the
// fix before a 10k+ send"). Published by publishChunkContinuation itself
// (from inside sendWhatsAppBroadcast) whenever a chunk finishes and more
// recipients remain, so this route re-triggers itself as many times as a
// send needs, never in the same function invocation as the one before it.

// A single chunk (CHUNK_SIZE recipients, sent CONCURRENCY at a time) needs
// real headroom for that many outbound Cloud API calls — the framework
// default is nowhere near enough.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), chunkContinuationCallbackUrl("whatsapp")))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const broadcastId = body?.broadcastId as string | undefined;
  if (!broadcastId) {
    return NextResponse.json({ error: "missing_broadcastId" }, { status: 400 });
  }

  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: broadcastId } });
  // Not found (deleted mid-send) or already finished (SENT — a QStash
  // retry landing after this broadcast's last chunk already completed
  // it) — either way, nothing left to do; not an error. Always 200:
  // returning non-2xx would make QStash retry a call with no useful work
  // left behind it.
  if (!broadcast || broadcast.status !== "SENDING") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await sendWhatsAppBroadcast(broadcastId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("whatsapp process-chunk: failed", broadcastId, err);
    // A real failure (not just "nothing to do") — 500 so QStash retries
    // with its own backoff, same as any other delivery failure. The
    // cursor already persisted from any earlier successful chunks, so a
    // retry resumes instead of restarting the whole broadcast.
    return NextResponse.json({ error: "process_failed" }, { status: 500 });
  }
}
