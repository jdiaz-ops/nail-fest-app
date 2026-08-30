import { NextResponse } from "next/server";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { getOrgSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

// "Ver ejemplo del PDF" link next to the Adjuntar PDF checkbox
// (/admin/settings/confirmation) — always renders, regardless of whether
// any real event/registration exists yet, so an admin can check the
// design before the first person ever registers. Fixed sample data, not
// a real registration's — the QR encodes an obviously-not-real string
// (never a signed lib/ticket.ts token) so a screenshot of this preview
// can never be mistaken for or scanned as a real ticket.
export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const orgSettings = await getOrgSettings();
  const sampleStart = new Date();
  sampleStart.setDate(sampleStart.getDate() + 30);
  const sampleEnd = new Date(sampleStart);

  const pdf = await renderTicketPdfBuffer({
    firstName: "Ana María",
    lastName: "Rodríguez",
    eventName: "Nail Fest Bogotá 2026",
    venueName: "Centro de Convenciones Ágora",
    venueAddress: "Cra. 40 #22C-67, Bogotá",
    startsAt: sampleStart,
    endsAt: sampleEnd,
    ticketTypeName: "Entrada general",
    confirmationCode: "EJEMPLO1",
    qrToken: "VISTA-PREVIA-NO-ES-UNA-ENTRADA-REAL",
    timezone: orgSettings.timezone,
    language: orgSettings.language,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=ejemplo-entrada-nailfest.pdf" },
  });
}
