import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { applyEmailTrackingEvent, type EmailTrackingStage } from "@/lib/email/tracking";

// The Resend-native counterpart to /api/webhooks/ses — only relevant once
// EMAIL_PROVIDER=resend (src/lib/email/index.ts) is actually flipped, see
// docs/RESEND_SETUP.md. Resend signs webhook deliveries via Svix
// (svix-id/svix-timestamp/svix-signature headers); resend.webhooks.verify()
// does the real signature verification (HMAC over the raw body — hence
// req.text(), never req.json() here, or the signature won't match).

function isConfigured(): boolean {
  // Fail closed if the secret isn't set yet — same posture as the SES
  // route's own isAuthorized().
  return Boolean(process.env.RESEND_WEBHOOK_SECRET);
}

const STAGE_BY_EVENT_TYPE: Partial<Record<string, EmailTrackingStage>> = {
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
};

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing_signature_headers" }, { status: 400 });
  }

  // Raw text, not parsed JSON — the signature is computed over the exact
  // bytes Resend sent, and re-serializing a parsed object can produce a
  // byte-for-byte different string (key order, whitespace) that fails
  // verification even though the content is "the same".
  const payload = await req.text();

  let event;
  try {
    // verify() itself never touches the API key (it's pure local HMAC
    // against RESEND_WEBHOOK_SECRET below, no network call) — but the
    // Resend constructor throws if its key argument is falsy regardless,
    // so this always passes a truthy string even when RESEND_API_KEY is
    // unset (dev/verification environments, or a deploy that's only
    // wired up the webhook secret so far).
    const resend = new Resend(process.env.RESEND_API_KEY || "unused-key-webhook-verify-only");
    event = resend.webhooks.verify({
      payload,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch (err) {
    console.error("Resend webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const messageId = "data" in event && "email_id" in event.data ? event.data.email_id : undefined;
  const stage = STAGE_BY_EVENT_TYPE[event.type];
  if (!messageId || !stage) {
    // sent/delivery_delayed/failed/received (inbound) aren't tracked as
    // their own timeline moment — same reasoning as the SES route's own
    // Send/Reject/DeliveryDelay, and non-email events (contacts/domains/
    // suppressions) obviously don't apply here at all.
    return NextResponse.json({ ok: true });
  }

  await applyEmailTrackingEvent(messageId, stage);
  return NextResponse.json({ ok: true });
}
