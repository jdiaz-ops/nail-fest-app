import type { Event, Person } from "@prisma/client";
import { hasActiveConsent } from "@/lib/consent";
import { getEnabledAutomation } from "./automations";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";

/** Fires the REGISTRATION_CONFIRMED automation (see lib/whatsapp/
 * automations.ts and the "Automatizaciones" tab, /admin/crm/whatsapp/
 * automatizaciones) — the LATAM Airlines-style pattern: a UTILITY
 * template (works outside the 24h customer-service window, unlike
 * sendTicketPdfViaWhatsApp's document send) whose one button is a dynamic
 * URL ending in "{{1}}", filled here with this registration's own
 * qrToken so it opens their own /api/ticket-pdf/[token] — same link
 * sendTicketPdfViaWhatsApp already uses, just delivered via a button
 * instead of an attached document.
 *
 * Silent no-op (never throws, never blocks the registration) when: no
 * admin has configured this automation yet, it's been turned off, or the
 * person has no WHATSAPP consent or no phone — same "swallow errors, log
 * the attempt" posture as sendTicketEmail and every other lib/whatsapp/*
 * send path (see recordOutboundMessage for where a real send failure ends
 * up). getEnabledAutomation only ever returns an APPROVED template (see
 * upsertAutomation's own validation), so that's not re-checked here.
 *
 * The body's two variables ({{1}} = first name, {{2}} = event name) are a
 * fixed convention, not a configurable mapping — this isn't a Difusión
 * broadcast (no WhatsAppBroadcast row to hold a variableMapping), it's
 * the one specific automation an admin picks a template for, so the
 * template text has to be written to match this shape (see the
 * "Plantilla sugerida" note in docs/WHATSAPP_SETUP.md). A template with a
 * different variableCount still gets as many of [firstName, eventName] as
 * it needs, in order — an extra {{3}}+ would just come through empty.
 */
export async function sendTicketLinkViaWhatsApp(params: {
  person: Person;
  event: Pick<Event, "name">;
  qrToken: string;
}): Promise<void> {
  const { person, event, qrToken } = params;
  if (!person.phone) return;

  const automation = await getEnabledAutomation("REGISTRATION_CONFIRMED");
  if (!automation) return;

  if (!(await hasActiveConsent(person.id, "WHATSAPP"))) return;

  const template = automation.template;
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
