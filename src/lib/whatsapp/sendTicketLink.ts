import { db } from "@/lib/db";
import type { Event, Person } from "@prisma/client";
import { getOrgSettings } from "@/lib/settings";
import { hasActiveConsent } from "@/lib/consent";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";

/** Auto-sends the ticket link over WhatsApp right after registration — the
 * LATAM Airlines-style pattern: a UTILITY template (works outside the 24h
 * customer-service window, unlike sendTicketPdfViaWhatsApp's document
 * send) whose one button is a dynamic URL ending in "{{1}}", filled here
 * with this registration's own qrToken so it opens their own
 * /api/ticket-pdf/[token] — same link sendTicketPdfViaWhatsApp already
 * uses, just delivered via a button instead of an attached document.
 *
 * Silent no-op (never throws, never blocks the registration) when: the
 * feature isn't turned on (OrgSettings.ticketLinkWhatsAppTemplateId is
 * null), the person has no WHATSAPP consent or no phone, or the picked
 * template isn't APPROVED yet — same "swallow errors, log the attempt"
 * posture as sendTicketEmail and every other lib/whatsapp/* send path
 * (see recordOutboundMessage for where a real send failure ends up).
 *
 * The body's two variables ({{1}} = first name, {{2}} = event name) are a
 * fixed convention, not a configurable mapping — this isn't a general
 * broadcast (no WhatsAppBroadcast row to hold a variableMapping), it's the
 * one specific template an admin picks for exactly this purpose, so the
 * template text has to be written to match this shape (see the "Plantilla
 * sugerida" note in docs/WHATSAPP_SETUP.md). A template with a different
 * variableCount still gets as many of [firstName, eventName] as it needs,
 * in order — an extra {{3}}+ would just come through empty.
 */
export async function sendTicketLinkViaWhatsApp(params: {
  person: Person;
  event: Pick<Event, "name">;
  qrToken: string;
}): Promise<void> {
  const { person, event, qrToken } = params;
  if (!person.phone) return;

  const orgSettings = await getOrgSettings();
  if (!orgSettings.ticketLinkWhatsAppTemplateId) return;

  if (!(await hasActiveConsent(person.id, "WHATSAPP"))) return;

  const template = await db.whatsAppTemplate.findUnique({ where: { id: orgSettings.ticketLinkWhatsAppTemplateId } });
  if (!template) {
    console.error("sendTicketLinkViaWhatsApp: configured template no longer exists", orgSettings.ticketLinkWhatsAppTemplateId);
    return;
  }
  if (template.status !== "APPROVED") {
    // Not a real failure — an admin picked a template that's still
    // PENDING/was REJECTED after picking it. Logged, not surfaced to the
    // registrant (the email ticket already went out either way).
    console.error("sendTicketLinkViaWhatsApp: configured template is not APPROVED", template.name, template.status);
    return;
  }

  const bodyValues = [person.firstName ?? "", event.name];
  const variables = bodyValues.slice(0, template.variableCount);
  const link = `${process.env.APP_BASE_URL || ""}/api/ticket-pdf/${qrToken}`;

  try {
    const result = await whatsappProvider.sendTemplate({
      to: person.phone,
      templateName: template.name,
      languageCode: template.language,
      variables,
      buttonUrlParam: qrToken,
    });
    await recordOutboundMessage({
      phone: person.phone,
      kind: "TEMPLATE",
      body: `[enlace de la entrada] ${link}`,
      templateId: template.id,
      providerMessageId: result.providerMessageId,
      status: "SENT",
    });
  } catch (err) {
    await recordOutboundMessage({
      phone: person.phone,
      kind: "TEMPLATE",
      body: `[enlace de la entrada] ${link}`,
      templateId: template.id,
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    console.error("whatsapp send-ticket-link failed", person.id, err);
  }
}
