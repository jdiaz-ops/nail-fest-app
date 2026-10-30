import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { requireUser } from "@/lib/auth/guard";
import { nailFestEventEmailSample, usesNailFestEventEmail } from "@/lib/nailfest/eventEmailFrame";
import { PDF_ATTACHMENT_NAME, sampleTicketPdf } from "@/lib/ticketPdfSample";

// "Send test email" — our previous ticketing platform's own field in the broadcast composer.
// A real send to real addresses the admin controls, but deliberately
// outside the real audience/consent/EmailLog machinery: this is the admin
// checking their own draft looks right, not a broadcast to a subscriber,
// so no unsubscribe link and no log row. In its event's design when the
// event chose one (Event.broadcastDesign, 2026-10-30), with its band; with
// the ticket's PDF — Laura's — when the email carries it.
const bodySchema = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  to: z.array(z.string().email()).min(1).max(10),
  band: z.string().max(60).nullable().optional(),
  attachTicketPdf: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { subject, bodyHtml, to, band, attachTicketPdf } = parsed.data;
  const event = await db.event.findUnique({ where: { id: params.id } });

  let html: string;
  let text = subject;
  if (event && usesNailFestEventEmail(event)) {
    const email = await nailFestEventEmailSample(event, { subject, bodyHtml, band: band ?? null, attachTicketPdf: Boolean(attachTicketPdf) });
    html = email.html;
    text = email.text;
  } else {
    // No real registrant to pull a link from in a test send — a clearly
    // fake example instead of leaving the raw {{ZOOM_LINK}} tag visible,
    // so the preview still reads like a real email. Same tag
    // sendEventBroadcast substitutes for real, see that function's own
    // comment.
    const previewBodyHtml = bodyHtml.split("{{ZOOM_LINK}}").join("https://zoom.us/j/000000000 (ejemplo)");
    const safeHtml = sanitizeEventDescription(previewBodyHtml);
    html = `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color:#1a1a1a;">
    <p style="background:#fdf1e6; color:#8a5a1f; padding:8px 12px; border-radius:6px; font-size:13px;">Este es un correo de PRUEBA — no se envió a ningún inscrito real.</p>
    ${safeHtml}
  </div>`;
  }
  const pdf = attachTicketPdf && event ? await sampleTicketPdf(event).catch(() => null) : null;

  // sendTransactional, not sendMarketing — matches the real channel a
  // sent event broadcast now uses (see lib/broadcasts.ts's own comment),
  // so this preview reflects the actual From address/Configuration Set.
  const results = await Promise.allSettled(
    to.map((addr) =>
      emailProvider.sendTransactional({
        to: addr,
        subject: `[PRUEBA] ${subject}`,
        text,
        html,
        attachments: pdf ? [{ filename: PDF_ATTACHMENT_NAME, content: pdf, contentType: "application/pdf" }] : undefined,
      })
    )
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return NextResponse.json({ ok: failed === 0, sent, failed });
}
