import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { emailProvider } from "@/lib/email";
import { senderNameFor } from "@/lib/brand";
import { imparablesClosingSample } from "@/lib/imparables/closing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** One address, or a few separated by commas. */
  email: z.string().trim().min(3).max(500),
});

// «Enviar prueba» of Manicuristas Imparables' closing email (2026-11-04): right now, to the team's own addresses, with
// sample data and «[Prueba]» before its subject. Nothing scheduled, no one else's inbox.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", message: "Escribe un correo válido." }, { status: 400 });
  const to = parsed.data.email
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  if (!to.length || to.length > 5 || to.some((a) => !z.string().email().safeParse(a).success)) {
    return NextResponse.json({ error: "invalid_email", message: "Escribe hasta 5 correos válidos, separados por coma." }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event || event.theme !== "IMPARABLES") return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const email = await imparablesClosingSample(event);
    for (const address of to) {
      await emailProvider.sendTransactional({ to: address, subject: `[Prueba] ${email.subject}`, text: email.text, html: email.html, fromName: senderNameFor(event) });
    }
    return NextResponse.json({ ok: true, sent: to });
  } catch (error) {
    console.error("closing: test send", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "send_failed", message: `No se pudo enviar la prueba: ${detail}` }, { status: 502 });
  }
}
