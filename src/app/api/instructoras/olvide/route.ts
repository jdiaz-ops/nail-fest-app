import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeUsername } from "@/lib/library/portal";

const bodySchema = z.object({ login: z.string().trim().min(1).max(160) });

// "¿Olvidaste tu contraseña?": nothing is emailed for now (2026-10-24) —
// the request shows in Editar biblioteca, and the team sends her a link
// by WhatsApp. The same answer whether or not the account exists.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe tu usuario o tu correo." }, { status: 400 });
  const { login } = parsed.data;
  const where = login.includes("@") ? { email: login.toLowerCase() } : { instructor: { slug: normalizeUsername(login) } };
  await db.instructorAccount.updateMany({ where, data: { resetRequestedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
