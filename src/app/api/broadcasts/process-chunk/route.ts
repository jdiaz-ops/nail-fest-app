import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEventBroadcast, sendSegmentEmailBroadcast } from "@/lib/broadcasts";
import { chunkContinuationCallbackUrl, verifyQstashSignature } from "@/lib/qstash";

// QStash's callback to continue an email broadcast send from wherever its
// persisted cursor left off — see sendEventBroadcast's own comment for
// why this exists (the real fix for "a background job/queue is the fix
// before a 10k+ send"). Published by publishChunkContinuation itself
// (from inside sendEventBroadcast/sendSegmentEmailBroadcast) whenever a
// chunk finishes and more recipients remain.

// A single chunk (CHUNK_SIZE recipients, sent CONCURRENCY at a time, each
// possibly rendering a ticket PDF) needs real headroom — the framework
// default is nowhere near enough.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), chunkContinuationCallbackUrl("email")))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  const broadcastId = body?.broadcastId as string | undefined;
  if (!broadcastId) {
    return NextResponse.json({ error: "missing_broadcastId" }, { status: 400 });
  }

  const broadcast = await db.emailBroadcast.findUnique({ where: { id: broadcastId } });
  // Not found (deleted mid-send) or already finished (SENT — a QStash
  // retry landing after this broadcast's last chunk already completed
  // it) — either way, nothing left to do; not an error. Always 200:
  // returning non-2xx would make QStash retry a call with no useful work
  // left behind it.
  if (!broadcast || broadcast.status !== "SENDING") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    // Exactly one of eventId/segmentId is ever set (enforced in
    // application code, not the DB — see EmailBroadcast.segmentId's own
    // schema comment), so this picks the same function the original send
    // would have used.
    const result = broadcast.eventId ? await sendEventBroadcast(broadcastId) : await sendSegmentEmailBroadcast(broadcastId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("broadcasts process-chunk: failed", broadcastId, err);
    // A real failure (not just "nothing to do") — 500 so QStash retries
    // with its own backoff. The cursor already persisted from any earlier
    // successful chunks, so a retry resumes instead of restarting.
    return NextResponse.json({ error: "process_failed" }, { status: 500 });
  }
}
