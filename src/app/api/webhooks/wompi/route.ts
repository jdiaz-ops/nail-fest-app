import { NextRequest, NextResponse } from "next/server";
import { verifyEventChecksum } from "@/lib/payments/wompi";
import { confirmRegistrationPayment } from "@/lib/payments/confirmRegistrationPayment";

// Wompi's "Eventos" webhook — configured once in the Wompi merchant
// dashboard (Developers → Eventos → this URL). Same posture as the
// WhatsApp/QStash webhooks elsewhere in this app: verify against the RAW
// body (before JSON.parse — see verifyEventChecksum's own comment on why
// it does its own parsing internally), always 200 quickly once verified,
// never let a downstream failure turn into a Wompi retry storm for
// something that isn't actually wrong on Wompi's end.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const event = verifyEventChecksum(rawBody);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  if (event.event !== "transaction.updated" || !event.data?.transaction) {
    // Some other event type Wompi added later that this app doesn't
    // handle yet — not an error, just nothing to do.
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await confirmRegistrationPayment(event.data.transaction);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("wompi webhook: confirmRegistrationPayment threw", err);
    // A real failure (DB blip, etc.) — 500 so Wompi retries with its own
    // backoff, same reasoning as the QStash/WhatsApp webhooks' own error paths.
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
