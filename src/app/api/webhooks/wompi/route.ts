import { NextRequest, NextResponse } from "next/server";
import { handleWompiEvent } from "@/lib/payments/wompiEvents";

// The events URL this app had while the Wompi comercio's "URL de Eventos"
// pointed here — until 2026-10-29, when marcolini.lat took it over and
// started relaying ours to /api/wompi/events instead. Kept for any event
// still arriving straight from Wompi: same checks, same handling, and no
// relaying onward any more — the Shopify integration (Conexa) that shares
// the comercio gets its events from Marcolini now.
export async function POST(req: NextRequest) {
  const { status, body } = await handleWompiEvent(await req.text(), req.headers.get("x-relay-secret"));
  return NextResponse.json(body, { status });
}
