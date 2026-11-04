import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { senderNameFor } from "@/lib/brand";

const bodySchema = z.object({ name: z.string().max(80) });

// Correos del evento (the team, 2026-11-04): the name all of an event's emails come from — its confirmation, its
// emails, its closing — as the inbox shows it (Event.emailSenderName). Empty: its brand's, «Manicuristas Imparables»
// for the congress and «Nail Fest» for every other event. From the next email on.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe un nombre de hasta 80 letras." }, { status: 400 });
  const event = await db.event.findUnique({ where: { id: params.id }, select: { theme: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Nothing that could break the From header; the brand's own name is the same as none.
  const typed = parsed.data.name.replace(/[\r\n"<>\\]/g, "").replace(/\s+/g, " ").trim();
  const own = typed && typed !== senderNameFor({ theme: event.theme }) ? typed : null;
  await db.event.update({ where: { id: params.id }, data: { emailSenderName: own } });
  return NextResponse.json({ ok: true, name: senderNameFor({ theme: event.theme, emailSenderName: own }) });
}
