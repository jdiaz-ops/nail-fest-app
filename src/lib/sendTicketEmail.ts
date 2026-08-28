import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates";
import { renderQrPngBuffer } from "@/lib/ticket";
import { getOrgSettings } from "@/lib/settings";

// Shared by /api/register (first send + resend-on-resubmit) and
// /api/resend-ticket (the self-serve "I lost my email" flow) — one place
// that renders the QR, builds the email, sends it, and logs the attempt,
// so both call sites stay identical instead of drifting apart.
export async function sendTicketEmail(params: {
  person: { id: string; email: string; firstName: string | null };
  event: { name: string; city: string; startsAt: Date };
  qrToken: string;
}): Promise<{ ok: boolean }> {
  try {
    const orgSettings = await getOrgSettings();
    // Real URL, not a base64 data: URI — see confirmationEmail's own
    // reasoning in the original /api/register comment: most inboxes drop
    // inline data: images.
    const qrImageUrl = `${process.env.APP_BASE_URL || ""}/api/ticket-qr/${params.qrToken}`;
    const { subject, text, html } = confirmationEmail({
      firstName: params.person.firstName ?? "",
      eventName: params.event.name,
      eventCity: params.event.city,
      startsAt: params.event.startsAt,
      qrImageUrl,
      orgName: orgSettings.name,
      timezone: orgSettings.timezone,
      language: orgSettings.language,
    });
    const qrAttachment = await renderQrPngBuffer(params.qrToken);
    const sent = await emailProvider.sendTransactional({
      to: params.person.email,
      subject,
      text,
      html,
      attachments: [{ filename: "entrada-nailfest.png", content: qrAttachment, contentType: "image/png" }],
    });
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: params.person.id,
        toEmail: params.person.email,
        sesMessageId: sent.providerMessageId,
        status: "SENT",
      },
    });
    return { ok: true };
  } catch (err) {
    // Never throw — the caller decides whether a failed send should fail
    // the whole request (it shouldn't, for a registration) or just report
    // "no lo pudimos enviar" (for a self-serve resend).
    await db.emailLog.create({
      data: {
        kind: "TRANSACTIONAL",
        personId: params.person.id,
        toEmail: params.person.email,
        status: "FAILED",
      },
    });
    console.error("sendTicketEmail failed", err);
    return { ok: false };
  }
}
