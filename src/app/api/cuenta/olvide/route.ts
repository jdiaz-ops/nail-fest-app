import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().min(1).max(160) });

// "¿Olvidaste tu contraseña?": nothing is emailed for now — the request
// shows in /admin/consultorio and the team sends her a link by WhatsApp or
// email by hand. The same answer whether or not the account exists.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe tu correo." }, { status: 400 });
  await db.communityMember.updateMany({ where: { email: parsed.data.email }, data: { resetRequestedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
