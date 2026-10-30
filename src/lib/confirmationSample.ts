import type { Event } from "@prisma/client";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { renderConfirmationFromTemplate, renderSubjectFromTemplate } from "@/lib/confirmationTemplate";
import { confirmationEmail } from "@/lib/email/templates";
import { issueQrToken } from "@/lib/ticket";
import { imparablesConfirmationPreview } from "@/lib/imparables/confirmation";

// An event's confirmation email with sample data (2026-10-30): what a buyer
// would get, for «Confirmación del evento»'s «Enviar prueba» and «Después
// del pago»'s preview. The same choice sendTicketEmail makes — the
// congress's design, the event's own template, the account's, or the
// original design — but from the mode asked for, and from what the editor
// has right now when it says so, saved or not. Laura, a sample code and a
// sample ticket (its QR opens nothing): no one's real data.

export type ConfirmationMode = "design" | "event" | "global";

/** Which of them this event sends today. */
export function savedConfirmationMode(event: Pick<Event, "confirmationEmailDesign" | "confirmationEmailHtml">): ConfirmationMode {
  return event.confirmationEmailDesign === "IMPARABLES" ? "design" : event.confirmationEmailHtml != null ? "event" : "global";
}

export async function sampleConfirmation(
  event: Event,
  mode: ConfirmationMode,
  unsaved: { html?: string | null; subject?: string | null; shareText?: string | null } = {}
): Promise<{ subject: string; text: string; html: string }> {
  const orgSettings = await getOrgSettings();
  const format = event.format ?? "IN_PERSON";
  const eventName = publicEventName(event);
  const subject = renderSubjectFromTemplate(
    unsaved.subject?.trim() || event.confirmationEmailSubject || orgSettings.confirmationEmailSubject || "Tu entrada para {{EVENTO_NOMBRE}}",
    {
      eventName,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? undefined,
      scheduleDays: event.scheduleDays,
      timezone: orgSettings.timezone,
      language: orgSettings.language,
      format,
    }
  );

  if (mode === "design") {
    const designed = await imparablesConfirmationPreview(event.id, unsaved.shareText !== undefined ? { shareText: unsaved.shareText } : {});
    if (designed) return { subject, ...designed };
  }

  const sample = {
    firstName: "Laura",
    lastName: "Gómez",
    eventName,
    venueName: event.venueName ?? undefined,
    venueAddress: event.venueAddress ?? undefined,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? undefined,
    scheduleDays: event.scheduleDays,
    qrImageUrl: `${process.env.APP_BASE_URL || ""}/api/ticket-qr/${issueQrToken("EJEMPLO")}`,
    ticketCount: 1,
    confirmationCode: "EJEMPLO1",
    orgName: orgSettings.name,
    timezone: orgSettings.timezone,
    language: orgSettings.language,
    format,
  };
  const template = mode === "event" ? (unsaved.html ?? event.confirmationEmailHtml) : orgSettings.confirmationEmailHtml;
  const { text, html } = template
    ? renderConfirmationFromTemplate(template, sample)
    : confirmationEmail({ ...sample, eventCity: event.city ?? "", eventImageUrl: event.imageUrl ?? undefined });
  return { subject, text, html };
}
