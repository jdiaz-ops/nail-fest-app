import type { Event, Person } from "@prisma/client";
import { hasActiveConsent } from "@/lib/consent";
import { getOrgSettings } from "@/lib/settings";
import { getEnabledAutomation, isDynamicUrlButton } from "./automations";
import { resolveMergeTag } from "./mergeTags";
import type { WhatsAppTemplateButton } from "./provider";
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
 * The link reaches the person through WHICHEVER of these the chosen
 * template actually has (both are supported, independently):
 *  - a body variable mapped to ZOOM_LINK (via variableMapping — plain
 *    text, the URL just sits in the message);
 *  - a dynamic URL button (Meta's "el enlace es distinto para cada
 *    persona") pointing at /api/zoom-join/{{1}} — see that route's own
 *    comment for why it exists instead of baking Zoom's own join_url
 *    straight into the approved template (it can't: the domain/meetingId
 *    differ per EVENT, not just per person, so it could never stay one
 *    stable, reusable template).
 * A template with body variables but no ZOOM_LINK mapped, and no button
 * either, would send a message with nothing personal in it — that's an
 * admin authoring mistake to fix in Automatizaciones, not something this
 * function tries to detect/refuse; unlike a missing automation entirely
 * (silent no-op, same as every other gate here), a picked-but-misconfigured
 * template should be visible as "it sent, but says nothing useful", not
 * silently swallowed. */
export async function sendZoomAccessReminder(params: {
  person: Person;
  event: Pick<Event, "name" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "format" | "scheduleDays">;
  zoomJoinUrl: string;
  /** This registration's own signed ticket token — reused (not a new
   * token type) as the credential /api/zoom-join/[token] verifies, only
   * used when the template actually has a dynamic URL button. */
  qrToken: string | null;
}): Promise<boolean> {
  const { person, event, zoomJoinUrl, qrToken } = params;
  if (!person.phone) return false;

  const automation = await getEnabledAutomation("ZOOM_ACCESS_REMINDER");
  if (!automation) return false;

  if (!(await hasActiveConsent(person.id, "WHATSAPP"))) return false;

  const template = automation.template;
  // Null (never configured) resolves every slot to "" — correct both
  // when the template genuinely has zero body variables (the whole
  // point rides on the button instead) and when an admin picked a
  // template with variables but hasn't mapped them yet (see this
  // function's own doc comment on why that's not gated out here).
  const mapping = (automation.variableMapping as Record<string, string> | null) ?? {};
  const orgSettings = await getOrgSettings();
  const ctx = { person, event, timezone: orgSettings.timezone, language: orgSettings.language, zoomJoinUrl };
  const variables = Array.from({ length: template.variableCount }, (_, i) => resolveMergeTag(mapping[String(i + 1)] ?? "", ctx));
  const hasButton = qrToken != null && ((template.buttons as unknown as WhatsAppTemplateButton[] | null) ?? []).some(isDynamicUrlButton);

  try {
    const result = await whatsappProvider.sendTemplate({
      to: person.phone,
      templateName: template.name,
      languageCode: template.language,
      variables,
      ...(hasButton ? { buttonUrlParam: qrToken! } : {}),
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
