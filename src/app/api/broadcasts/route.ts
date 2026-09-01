import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendSegmentEmailBroadcast } from "@/lib/broadcasts";
import { requireUser } from "@/lib/auth/guard";

// A broadcast targets an EXISTING, named segment (built once in
// /admin/crm/segments, synced to Meta, reusable) — it used to accept a
// raw filter and silently create a brand-new, one-off SegmentDefinition
// named after the email subject on every single send, which meant (a) no
// Meta sync for that "segment" ever happened, and (b) sending the same
// audience twice meant rebuilding the filter from scratch instead of
// picking it from a list. Segmentos owns audience definitions now;
// Broadcasts only consumes them.
const bodySchema = z.object({
  segmentId: z.string().min(1),
  subject: z.string().min(1),
  bodyText: z.string().min(1),
});

// The actual send (chunked, with a QStash continuation for anything
// bigger than one chunk — see lib/broadcasts.ts's sendSegmentEmailBroadcast)
// can span several minutes for a big segment even though each individual
// invocation stays well under this. Matters for the FIRST chunk, sent
// synchronously in this same request before any continuation kicks in.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // This route sits under /api/broadcasts, NOT /api/admin/* — the old
  // Basic Auth middleware's matcher only covered /admin/:path* and
  // /api/admin/:path*, so this endpoint (send a real marketing email to a
  // real segment) was reachable with no auth at all. Caught while
  // rebuilding the auth system from scratch; fixed here rather than left.
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { segmentId, subject, bodyText } = parsed.data;

  const segment = await db.segmentDefinition.findUnique({ where: { id: segmentId } });
  if (!segment) {
    return NextResponse.json({ error: "segment_not_found" }, { status: 404 });
  }
  const broadcast = await db.emailBroadcast.create({
    data: { segmentId: segment.id, subject, bodyText, status: "SENDING" },
  });

  const result = await sendSegmentEmailBroadcast(broadcast.id);

  return NextResponse.json({
    ok: true,
    broadcastId: broadcast.id,
    sent: result.sent,
    segmentSize: result.total,
    skippedNoConsent: result.skippedNoConsent,
    // > 0 only for a segment bigger than one chunk — the rest is still
    // going out via a QStash continuation, not lost or waiting on
    // anything the admin needs to retrigger (see BroadcastComposer.tsx's
    // own handling of this).
    remaining: result.remaining,
    backgrounded: result.backgrounded,
  });
}

export async function GET() {
  const broadcasts = await db.emailBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { segment: true, _count: { select: { logs: true } } },
  });
  return NextResponse.json({ broadcasts });
}
