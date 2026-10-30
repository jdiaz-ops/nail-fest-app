import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { emailProvider } from "@/lib/email";
import { getOrgSettings } from "@/lib/settings";
import { sampleTicketPdf } from "@/lib/ticketPdfSample";
import { sampleConfirmation } from "@/lib/confirmationSample";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** One address, or a few separated by commas. */
  email: z.string().trim().min(3).max(500),
  mode: z.enum(["design", "event", "global"]),
  /** The editor's, unsaved. */
  html: z.string().max(200_000).optional(),
  subject: z.string().max(300).optional(),
  shareText: z.string().max(500).optional(),
});

// «Enviar prueba» (2026-10-30): an event's confirmation email right now, to
// the team's own addresses, with sample data and «[Prueba]» before its
// subject — what «Confirmación del evento» shows, saved or not (see
// lib/confirmationSample.ts). Nothing scheduled, no one else's inbox. With
// the ticket's PDF when the real one goes with it (an event at a place, and
// «Adjuntar la entrada como PDF» on) — Laura's, its QR opening nothing.
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
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const { html, subject, shareText } = parsed.data;
    const email = await sampleConfirmation(event, parsed.data.mode, { html, subject, ...(shareText !== undefined ? { shareText } : {}) });
    const orgSettings = await getOrgSettings();
    const pdf = orgSettings.attachTicketPdf && event.format !== "VIRTUAL" ? await sampleTicketPdf(event) : null;
    for (const address of to) {
      await emailProvider.sendTransactional({
        to: address,
        subject: `[Prueba] ${email.subject}`,
        text: email.text,
        html: email.html,
        attachments: pdf ? [{ filename: "entrada-nailfest.pdf", content: pdf, contentType: "application/pdf" }] : undefined,
      });
    }
    return NextResponse.json({ ok: true, sent: to });
  } catch (error) {
    console.error("confirmation: test send", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "send_failed", message: `No se pudo enviar la prueba: ${detail}` }, { status: 502 });
  }
}
