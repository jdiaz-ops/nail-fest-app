import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { eventEmailSample } from "@/lib/eventEmailDesign";

export const dynamic = "force-dynamic";

// «Ver con el diseño» in Correos del evento (2026-10-30): one of its emails,
// as it's saved, in the event's design — on or not yet —, with sample data.
// Nothing sent.
export async function GET(_req: Request, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id }, include: { event: true } });
  if (!broadcast?.event || !broadcast.bodyHtml) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await eventEmailSample(broadcast.event, {
    subject: broadcast.subject,
    bodyHtml: broadcast.bodyHtml,
    band: broadcast.designBand,
    asistire: broadcast.designAsistire,
    colega: broadcast.designColega,
    kit: broadcast.designKit,
    pdf: broadcast.attachTicketPdf,
  });
  if (!email) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
