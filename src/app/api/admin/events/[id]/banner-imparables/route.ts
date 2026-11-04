import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";

const bodySchema = z.object({ on: z.boolean() });

// «Después de la inscripción» › «Entrada (PDF)» (2026-11-04): Manicuristas
// Imparables' banner on this event's tickets, on or off (Event.
// imparablesTicketBanner; lib/ticketPdf.ts). Off by default for every event;
// on, it shows only while the congress's sales are open.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: params.id }, select: { theme: true, format: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasNailFestAsistire(event)) {
    return NextResponse.json({ error: "not_in_person", message: "El banner va en las entradas de los eventos presenciales de Nail Fest." }, { status: 400 });
  }
  await db.event.update({ where: { id: params.id }, data: { imparablesTicketBanner: parsed.data.on } });
  return NextResponse.json({ ok: true });
}
