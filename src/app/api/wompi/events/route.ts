import { NextRequest, NextResponse } from "next/server";
import { handleWompiEvent } from "@/lib/payments/wompiEvents";

// Wompi's events for Nail Fest's own transactions (references NF-...). The
// comercio is shared with marcolini.lat, whose "URL de Eventos" it is:
// Marcolini relays ours here, the body untouched plus `x-relay-secret`,
// answering Wompi itself right away and retrying here (up to 4 times) on
// anything but a 2xx — so a 500 from here means "try again", on purpose.
// Verified against the RAW body, before anything else — see handleWompiEvent.
export async function POST(req: NextRequest) {
  const { status, body } = await handleWompiEvent(await req.text(), req.headers.get("x-relay-secret"));
  return NextResponse.json(body, { status });
}
