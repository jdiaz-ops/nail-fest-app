import { NextRequest, NextResponse } from "next/server";
import { verifyQrToken } from "@/lib/ticket";
import { buildTicketPdfDataForRegistration, renderTicketPdfBuffer } from "@/lib/ticketPdf";

// Serves the ticket PDF as a normal URL — same "the token IS the
// credential" reasoning as /api/ticket-qr (this endpoint is
// intentionally public/unauthenticated), and the same shape, just a PDF
// instead of a PNG. Exists specifically so WhatsApp document sends have
// something to point their `link` at — Meta's Cloud API fetches the URL
// itself server-side, it doesn't accept an uploaded buffer inline (see
// lib/whatsapp/sendTicketPdf.ts).
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { valid, registrationId } = verifyQrToken(params.token);
  if (!valid || !registrationId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const data = await buildTicketPdfDataForRegistration(registrationId);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pdf = await renderTicketPdfBuffer(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=entrada-nailfest.pdf",
      // Not cacheable: the same link has to reflect the order as it is now
      // (e.g. an order edited to 2 tickets gets the companion's page), and
      // it's a per-person document, not a shared asset. Rendering is cheap.
      "Cache-Control": "private, no-store",
    },
  });
}
