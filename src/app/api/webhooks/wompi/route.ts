import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyEventChecksum, relayToOtherIntegration } from "@/lib/payments/wompi";
import { confirmRegistrationPayment } from "@/lib/payments/confirmRegistrationPayment";

// Wompi's "Eventos" webhook — configured once in the Wompi merchant
// dashboard (Developers → Eventos → this URL). Same posture as the
// WhatsApp/QStash webhooks elsewhere in this app: verify against the RAW
// body (before JSON.parse — see verifyEventChecksum's own comment on why
// it does its own parsing internally), always 200 quickly once verified,
// never let a downstream failure turn into a Wompi retry storm for
// something that isn't actually wrong on Wompi's end.
//
// This comercio's "URL de Eventos" is SHARED with an existing Shopify
// integration (see docs/PAYMENTS_SETUP.md's own "Cuenta compartida con
// Shopify" section) — Wompi only allows ONE such URL per comercio, so
// this route is now the single front door for both. Every event is
// checked against OUR OWN Payment rows first; anything that isn't ours
// gets relayed byte-for-byte to WOMPI_SHOPIFY_RELAY_URL instead of being
// silently dropped — see relayToOtherIntegration's own comment for why
// that's safe (the downstream checksum check still passes) and what it
// deliberately does NOT protect against (this app going down takes both
// integrations' webhook down with it).
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const event = verifyEventChecksum(rawBody);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const transaction = event.event === "transaction.updated" ? event.data?.transaction : undefined;
  const reference = transaction?.reference;
  const ownPayment = reference
    ? await db.payment.findFirst({ where: { OR: [{ id: reference }, { providerReference: transaction!.id }] } })
    : null;

  if (!ownPayment) {
    // Not a Nail Fest transaction (or not even a transaction.updated
    // event at all) — assumed to belong to whatever else shares this
    // comercio. Relayed unchanged; never processed as our own.
    await relayToOtherIntegration(rawBody, req.headers);
    return NextResponse.json({ ok: true, relayed: true });
  }

  try {
    const result = await confirmRegistrationPayment(transaction!);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("wompi webhook: confirmRegistrationPayment threw", err);
    // A real failure (DB blip, etc.) — 500 so Wompi retries with its own
    // backoff, same reasoning as the QStash/WhatsApp webhooks' own error paths.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
