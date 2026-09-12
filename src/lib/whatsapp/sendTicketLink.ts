import type { Event, Person } from "@prisma/client";
import { hasActiveConsent } from "@/lib/consent";
import { getOrgSettings } from "@/lib/settings";
import { getEnabledAutomation } from "./automations";
import { resolveMergeTag } from "./mergeTags";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";

/** Fires the REGISTRATION_CONFIRMED automation (see lib/whatsapp/
 * automations.ts and the "Automatizaciones" tab, /admin/crm/whatsapp/
 * automatizaciones) — the LATAM Airlines-style pattern: a UTILITY
 * template (works outside the 24h customer-service window, unlike
 * sendTicketPdfViaWhatsApp's document send) whose button (if it has one)
 * is a dynamic URL ending in "{{1}}", filled here with this
 * registration's own qrToken so it opens their own
 * /api/ticket-pdf/[token] — same link sendTicketPdfViaWhatsApp already
 * uses, just delivered via a button instead of an attached document.
 *
 * Silent no-op (never throws, never blocks the registration) when: no
 * admin has configured this automation yet, it's been turned off, or the
 * person has no WHATSAPP consent or no phone — same "swallow errors, log
 * the attempt" posture as sendTicketEmail and every other lib/whatsapp/*
 * send path (see recordOutboundMessage for where a real send failure ends
 * up). getEnabledAutomation only ever returns an APPROVED template (see
 * upsertAutomation's own validation), so that's not re-checked here.
 *
 * The body's variables come from automation.variableMapping when an
 * admin has configured one (any order, any of WHATSAPP_MERGE_TAGS — see
 * that module's own comment on why this replaced the old fixed
 * convention: a real admin-authored template doesn't always want
 * firstName first, or at all). Falls back to the OLD fixed convention
 * ([firstName, eventName], in that order) when variableMapping is unset
 * — every automation configured before mapping existed keeps working
 * identically.
 *
 * Returns whether it actually attempted a send (got past every gate),
 * NOT whether the provider call itself succeeded — same "did we try,"
 * not "did it arrive" signal /api/register already gives sendTicketEmail
 * no equivalent of. Used to decide whether the confirmation modal's own
 * "ya va camino a tu WhatsApp" line is true before showing it — see
 * EventRegistration.tsx.
 */
export async function sendTicketLinkViaWhatsApp(params: {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays">;
  qrToken: string;
}): Promise<boolean> {
  const { person, event, qrToken } = params;
  if (!person.phone) return false;

  // A pure VIRTUAL event can have its own APPROVED template configured
  // (see AutomationFormatScope's own comment) — falls back to the usual
  // one when nobody's set that up, same as before this scope existed.
  const automation = await getEnabledAutomation("REGISTRATION_CONFIRMED", event.format);
  if (!automation) return false;

  if (!(await hasActiveConsent(person.id, "WHATSAPP"))) return false;

  const template = automation.template;
  const mapping = automation.variableMapping as Record<string, string> | null;
  let variables: string[];
  if (mapping) {
    const orgSettings = await getOrgSettings();
    const ctx = { person, event, timezone: orgSettings.timezone, language: orgSettings.language };
    variables = Array.from({ length: template.variableCount }, (_, i) => resolveMergeTag(mapping[String(i + 1)] ?? "", ctx));
  } else {
    variables = [person.firstName ?? "", event.name].slice(0, template.variableCount);
  }
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
  return true;
}
