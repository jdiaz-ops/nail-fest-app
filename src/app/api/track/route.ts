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
// NOTE: this slice is CAPI-only — there's no browser Meta Pixel snippet
// wired up yet, so there's nothing to deduplicate against. Adding the
// client-side fbq() snippet with a matching eventID is a small follow-up,
// not a redesign — see README "known simplifications".

const bodySchema = z.object({
  eventName: z.enum(["PageView", "ViewContent", "InitiateCheckout"]),
  eventSourceUrl: z.string().url(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { eventName, eventSourceUrl, fbc, fbp } = parsed.data;

  // Fire-and-forget from the caller's point of view: a Meta hiccup must
  // never surface as an error to the visitor. queueMetaEvent already
  // swallows failures into the retry queue.
  await queueMetaEvent({
    eventId: randomUUID(),
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
