import type { Event, Person } from "@prisma/client";
import { hasActiveConsent } from "@/lib/consent";
import { getOrgSettings } from "@/lib/settings";
import { getEnabledAutomation } from "./automations";
import { resolveMergeTag } from "./mergeTags";
import { whatsappProvider } from "./index";
import { recordOutboundMessage } from "./inbox";

/** Fires the ZOOM_ACCESS_REMINDER automation — see WhatsAppAutomationTrigger's
 * own schema comment for why this is a SEPARATE trigger from
 * REGISTRATION_CONFIRMED, not the same message sent twice: the personal
 * Zoom join link is deliberately withheld until shortly before the event
 * (see /api/zoom/send-access-reminder, the QStash callback that calls
 * this), so it never sits unused for months in someone's confirmation
 * message.
 *
 * Unlike sendTicketLinkViaWhatsApp, there's no old fixed-convention
 * fallback here — this trigger didn't exist before variableMapping did,
 * so an admin MUST map at least the ZOOM_LINK tag to some slot for this
 * to be worth sending at all. No mapping configured yet (only a
 * template picked) is treated the same as no automation configured —
 * silent no-op, same posture as every other gate here — rather than
 * sending a message with a blank link. */
export async function sendZoomAccessReminder(params: {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays">;
  zoomJoinUrl: string;
}): Promise<boolean> {
  const { person, event, zoomJoinUrl } = params;
  if (!person.phone) return false;

  const automation = await getEnabledAutomation("ZOOM_ACCESS_REMINDER");
  if (!automation) return false;
  const mapping = automation.variableMapping as Record<string, string> | null;
  if (!mapping) return false;

  if (!(await hasActiveConsent(person.id, "WHATSAPP"))) return false;

  const template = automation.template;
  const orgSettings = await getOrgSettings();
  const ctx = { person, event, timezone: orgSettings.timezone, language: orgSettings.language, zoomJoinUrl };
  const variables = Array.from({ length: template.variableCount }, (_, i) => resolveMergeTag(mapping[String(i + 1)] ?? "", ctx));

  try {
    const result = await whatsappProvider.sendTemplate({
      to: person.phone,
      templateName: template.name,
      languageCode: template.language,
      variables,
    });
    await recordOutboundMessage({
      phone: person.phone,
      kind: "TEMPLATE",
      body: `[recordatorio de acceso a Zoom] ${zoomJoinUrl}`,
      templateId: template.id,
      providerMessageId: result.providerMessageId,
      status: "SENT",
    });
  } catch (err) {
    await recordOutboundMessage({
      phone: person.phone,
      kind: "TEMPLATE",
      body: `[recordatorio de acceso a Zoom] ${zoomJoinUrl}`,
      templateId: template.id,
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    console.error("whatsapp send-zoom-access-reminder failed", person.id, err);
  }
  return true;
}
