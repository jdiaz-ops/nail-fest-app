import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Receives SNS notifications from the SES event destination (see
// docs/SES_EVENT_TRACKING.md for the AWS-side setup this depends on —
// that part can't be done from here, it needs the AWS console). Two SNS
// message types matter:
//  - SubscriptionConfirmation: SNS's own handshake when the topic
//    subscription is first created — we have to fetch the SubscribeURL
//    ourselves once, or SNS never actually starts delivering.
//  - Notification: the real payload, itself a JSON string (SNS wraps
//    whatever the publisher sent) containing SES's own event JSON.
//
// No AWS SDK needed — SNS just POSTs plain JSON over HTTPS.

// SNS doesn't sign requests with anything this route can cheaply verify
// (real signature verification means fetching AWS's public cert and doing
// PKCS1v15/SHA1 — a real chunk of code for a first pass). As a practical
// stopgap, the subscription URL in AWS carries a shared secret query
// param that a random POST to this path won't have — not real signature
// verification, but it stops the obvious "someone found the URL and is
// spamming fake Bounce events" case. Tightening this to real SNS message
// signing is a fair follow-up, not done here.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SES_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed, same posture as middleware.ts's admin gate
  return req.nextUrl.searchParams.get("token") === secret;
}

interface SesMailEvent {
  eventType: "Send" | "Delivery" | "Open" | "Click" | "Bounce" | "Complaint" | "Reject" | "DeliveryDelay" | "Subscription";
  mail: { messageId: string };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // --- SNS handshake — required once per subscription, harmless to leave
  // handled permanently (a topic is never re-subscribed in normal use). ---
  if (body.Type === "SubscriptionConfirmation" && typeof body.SubscribeURL === "string") {
    await fetch(body.SubscribeURL).catch((err) => {
      console.error("Failed to confirm SNS subscription", err);
    });
    return NextResponse.json({ ok: true });
  }

  if (body.Type !== "Notification" || typeof body.Message !== "string") {
    // SNS also sends UnsubscribeConfirmation — nothing to do with those.
    return NextResponse.json({ ok: true });
  }

  const event: SesMailEvent | null = (() => {
    try {
      return JSON.parse(body.Message);
    } catch {
      return null;
    }
  })();
  if (!event?.mail?.messageId) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const patch: Record<string, unknown> = {};
  switch (event.eventType) {
    case "Delivery":
      patch.deliveredAt = now;
      patch.status = "DELIVERED";
      break;
    case "Open":
      patch.openedAt = now;
      patch.status = "OPENED";
      break;
    case "Click":
      patch.firstClickedAt = now;
      patch.status = "CLICKED";
      break;
    case "Bounce":
      patch.bouncedAt = now;
      patch.status = "BOUNCED";
      break;
    case "Complaint":
      patch.complainedAt = now;
      patch.status = "COMPLAINED";
      break;
    default:
      // Send/Reject/DeliveryDelay aren't tracked as their own timeline
      // moments today — QUEUED→SENT already happens at send time in
      // sendTicketEmail.ts/the broadcast sender, before SES is even involved.
      return NextResponse.json({ ok: true });
  }

  // updateMany, not update: a bad/duplicate SNS redelivery naming a
  // messageId we don't have on file should be a no-op, not a 500 — and
  // openedAt/etc. are "first occurrence" fields, so re-applying the same
  // event type (SNS redelivers on retry) just leaves the same timestamp
  // rather than overwriting it forward — see the guard below.
  const existing = await db.emailLog.findFirst({ where: { sesMessageId: event.mail.messageId } });
  if (!existing) return NextResponse.json({ ok: true });

  // Never let a later-arriving Delivery notification stomp an Open/Click
  // that already progressed further, and never overwrite an
  // already-recorded timestamp for the same field (first occurrence wins).
  const STAGE_ORDER = ["QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"];
  const patchStatus = patch.status as string;
  if (STAGE_ORDER.indexOf(patchStatus) < STAGE_ORDER.indexOf(existing.status)) {
    delete patch.status;
  }
  for (const field of ["deliveredAt", "openedAt", "firstClickedAt", "bouncedAt", "complainedAt"] as const) {
    if (field in patch && existing[field]) delete patch[field];
  }

  if (Object.keys(patch).length > 0) {
    await db.emailLog.update({ where: { id: existing.id }, data: patch });
  }

  return NextResponse.json({ ok: true });
}
