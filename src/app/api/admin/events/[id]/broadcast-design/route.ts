import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { eventEmailDesignOf } from "@/lib/eventEmailDesign";

const bodySchema = z.object({ on: z.boolean() });

// Correos del evento (2026-10-30): its design for all of an event's emails —
// Nail Fest's, or Manicuristas Imparables' (2026-11-04) —, on or off
// (Event.broadcastDesign), from their next send, scheduled ones included.
// Off, as always.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const event = await db.event.findUnique({ where: { id: params.id }, select: { theme: true, format: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Nail Fest's for its events at a place, Manicuristas Imparables' for the congress (2026-11-04).
  const design = eventEmailDesignOf(event);
  if (!design) {
    return NextResponse.json({ error: "no_design", message: "Este evento no tiene un diseño para sus correos." }, { status: 400 });
  }
  await db.event.update({ where: { id: params.id }, data: { broadcastDesign: parsed.data.on ? design : null } });
  return NextResponse.json({ ok: true });
}
