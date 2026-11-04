import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sampleTicketPdf } from "@/lib/ticketPdfSample";

export const dynamic = "force-dynamic";

// «Después de la inscripción» › «Entrada (PDF)» (2026-11-04): this event's
// ticket with sample data — Laura's, one ticket or two (hers and her
// companion's), its QR opening nothing — with Manicuristas Imparables'
// banner as the real one carries it, or (?banner=1) as it would with the
// switch on.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const tickets = req.nextUrl.searchParams.get("entradas") === "2" ? 2 : 1;
  const pdf = await sampleTicketPdf(event, { banner: req.nextUrl.searchParams.get("banner") === "1", ticketCount: tickets });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=entrada-de-muestra.pdf", "Cache-Control": "private, no-store" },
  });
}
