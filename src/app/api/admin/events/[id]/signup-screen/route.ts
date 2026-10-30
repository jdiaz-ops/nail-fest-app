import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { NAIL_FEST_DESIGN } from "@/lib/nailfest/confirmation";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";

const bodySchema = z.object({ on: z.boolean() });

// «Después de la inscripción» (2026-10-30): Nail Fest's own screen right
// after signing up, on or off for an event at a place (Event.
// signupScreenDesign; components/nailfest/SignedUp.tsx). Off, the usual one.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: params.id }, select: { theme: true, format: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasNailFestAsistire(event)) {
    return NextResponse.json({ error: "not_in_person", message: "Esta pantalla es para los eventos presenciales de Nail Fest." }, { status: 400 });
  }
  await db.event.update({ where: { id: params.id }, data: { signupScreenDesign: parsed.data.on ? NAIL_FEST_DESIGN : null } });
  return NextResponse.json({ ok: true });
}
