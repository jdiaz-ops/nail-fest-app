import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import { nailFestEventEmailSample } from "@/lib/nailfest/eventEmailFrame";

export const dynamic = "force-dynamic";

// «Ver con el diseño» in Correos del evento (2026-10-30): one of its emails,
// as it's saved, in the event's design — on or not yet —, with sample data.
// Nothing sent.
export async function GET(_req: Request, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id }, include: { event: true } });
  if (!broadcast?.event || !broadcast.bodyHtml || !hasNailFestAsistire(broadcast.event)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await nailFestEventEmailSample(broadcast.event, {
    subject: broadcast.subject,
    bodyHtml: broadcast.bodyHtml,
    band: broadcast.designBand,
    asistire: broadcast.designAsistire,
    colega: broadcast.designColega,
    pdf: broadcast.attachTicketPdf,
  });
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
