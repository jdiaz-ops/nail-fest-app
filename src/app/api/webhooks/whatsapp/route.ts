import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getWhatsAppConnectionOrNull } from "@/lib/whatsapp/connection";
import { processWebhookPayload } from "@/lib/whatsapp/inbox";

// Meta's WhatsApp Cloud API webhook — one URL handles two very different
// requests (see developers.facebook.com/docs/graph-api/webhooks/getting-started):
//  - GET: the one-time verification handshake Meta does when you paste
//    this URL + a verify token into the App dashboard's Webhooks config.
//  - POST: the real event stream (inbound messages + delivery statuses)
//    once verification succeeded, for the rest of this connection's life.

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  const conn = await getWhatsAppConnectionOrNull();
  if (!conn) {
    // Fail closed — same posture as the SES webhook's isAuthorized(): no
    // connection configured means nothing legitimate should be hitting
    // this yet.
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  if (mode === "subscribe" && token === conn.webhookVerifyToken && challenge) {
    // Meta expects the raw challenge string back, not JSON.
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

/** Meta signs every POST with the App Secret (the same META_APP_SECRET
 * already used for the Meta ads/CAPI module — a WhatsApp app and an ads
 * Business app are typically the same Meta App) as
 * `sha256=<hex hmac of the raw body>` in X-Hub-Signature-256. Verified
 * against the RAW body bytes, before any JSON.parse — HMACs don't survive
 * re-serialization matching byte-for-byte. */
function isValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const headerBuf = Buffer.from(header);
  if (expectedBuf.length !== headerBuf.length) return false;
  return timingSafeEqual(expectedBuf, headerBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!isValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody || "{}");
  // Always 200 quickly and process best-effort — Meta retries with
  // backoff and eventually disables the webhook subscription on
  // sustained non-200s, and processWebhookPayload() itself never throws
  // (see its own comment) so there's nothing here that should 500.
  await processWebhookPayload(body).catch((err) => console.error("whatsapp webhook processing failed", err));
  return NextResponse.json({ ok: true });
}
