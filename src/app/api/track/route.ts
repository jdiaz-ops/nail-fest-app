import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { queueMetaEvent } from "@/lib/meta/capi";
import { clientIpFromHeaders, userAgentFromHeaders } from "@/lib/request";

// PageView / ViewContent / InitiateCheckout — fired before we know who the
// visitor is, so no email/phone here (that only exists from /api/register
// onward, where Purchase is fired server-side instead). Matching quality
// leans on IP/UA/fbc/fbp, which is normal for pre-identification events.
//
// `eventId`: the browser Meta Pixel (see MetaPixelScript.tsx) fires the
// same event client-side with a matching eventID, generated in
// tracking.ts's track() — Meta dedupes on (event_name, event_id), so this
// is what stops the Pixel and this CAPI call from being counted as two
// separate events. Falls back to generating one here if the client didn't
// send one for some reason, same as before the Pixel existed.

const bodySchema = z.object({
  eventName: z.enum(["PageView", "ViewContent", "InitiateCheckout"]),
  eventId: z.string().optional(),
  eventSourceUrl: z.string().url(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { eventName, eventId, eventSourceUrl, fbc, fbp } = parsed.data;

  // Fire-and-forget from the caller's point of view: a Meta hiccup must
  // never surface as an error to the visitor. queueMetaEvent already
  // swallows failures into the retry queue.
  await queueMetaEvent({
    eventId: eventId ?? randomUUID(),
    eventName,
    eventSourceUrl,
    userData: {
      clientIpAddress: clientIpFromHeaders(),
      clientUserAgent: userAgentFromHeaders(),
      fbc,
      fbp,
    },
  });

  return NextResponse.json({ ok: true });
}
