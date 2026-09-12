import { db } from "@/lib/db";
import type { AutomationFormatScope, EventFormat, WhatsAppAutomationTrigger } from "@prisma/client";
import type { WhatsAppTemplateButton } from "./provider";

/** Registry of every trigger this app knows how to fire — the single
 * source of truth for the "Automatizaciones" page (one card per entry,
 * configured or not) and for validating a create/update request. Adding a
 * new trigger later (check-in, event reminder, ...) means: add it to the
 * WhatsAppAutomationTrigger enum (schema.prisma), add the actual firing
 * call wherever that event happens (see REGISTRATION_CONFIRMED's own call
 * site, sendTicketLinkViaWhatsApp() below, called from /api/register), and
 * add its entry here — the page and API route pick it up automatically. */
export const AUTOMATION_TRIGGERS: Record<
  WhatsAppAutomationTrigger,
  { label: string; description: string; supportsVirtualOverride: boolean }
> = {
  REGISTRATION_CONFIRMED: {
    label: "Cuando alguien se registra",
    description:
      "Justo después de la confirmación (registro nuevo o un reenvío), le llega un WhatsApp con un botón que abre su propia entrada — mismo enlace que \"Reenviar PDF por WhatsApp\" en Bandeja, pero funciona incluso fuera de la ventana de 24h porque es una plantilla, no un documento suelto.",
    supportsVirtualOverride: true,
  },
  ZOOM_ACCESS_REMINDER: {
    label: "Poco antes de un evento virtual",
    description:
      "Se manda solo, poco antes de que empiece un evento VIRTUAL o HÍBRIDO (ver ZOOM_ACCESS_REMINDER_MINUTES_BEFORE), a cada persona ya confirmada con acceso a Zoom — con su link personal de unirse. El link no se manda antes de eso (ni en el correo de confirmación ni en la landing de pago), para no entregar un enlace que se pierda si alguien se registra con mucha anticipación.",
    // Solo aplica a eventos virtuales/híbridos por definición — no tiene
    // sentido un "override para virtuales" de algo que YA es solo para
    // virtuales, a diferencia de REGISTRATION_CONFIRMED (que también
    // dispara en eventos presenciales).
    supportsVirtualOverride: false,
  },
};

export const AUTOMATION_TRIGGER_LIST = Object.keys(AUTOMATION_TRIGGERS) as WhatsAppAutomationTrigger[];

// Exported — sendTicketLinkViaWhatsApp/sendZoomAccessReminder each need
// this same check at send time, to decide whether to pass buttonUrlParam
// at all (Meta rejects a template send whose components don't match the
// approved template's own shape — passing a button parameter for a
// template with no button component is exactly that mismatch).
export function isDynamicUrlButton(b: WhatsAppTemplateButton): boolean {
  return b.type === "URL" && b.url.includes("{{");
}

/** APPROVED templates an automation can use — either kind of
 * personalization qualifies: a dynamic URL button (the original design —
 * "open your own ticket") OR at least one body variable (filled via
 * variableMapping, see WhatsAppAutomation's own schema comment). A
 * template with neither would send identical text to everyone, which
 * defeats the point of a per-person automation. bodyText/variableCount
 * are returned too so the admin UI can render the variable-mapping
 * selects and a live preview, same as WhatsAppBroadcastComposer's own. */
export async function listEligibleAutomationTemplates(): Promise<
  { id: string; name: string; language: string; bodyText: string; variableCount: number }[]
> {
  const templates = await db.whatsAppTemplate.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } });
  return templates
    .filter((t) => t.variableCount > 0 || ((t.buttons as unknown as WhatsAppTemplateButton[] | null) ?? []).some(isDynamicUrlButton))
    .map((t) => ({ id: t.id, name: t.name, language: t.language, bodyText: t.bodyText ?? "", variableCount: t.variableCount }));
}

/** One row per configured (trigger, formatScope) pair — unconfigured ones
 * just aren't in this list, same "absence means off" reasoning as
 * everywhere else in the app. The Automatizaciones page cross-references
 * this against AUTOMATION_TRIGGER_LIST to also show the not-yet-
 * configured ones, and splits DEFAULT vs. VIRTUAL rows into the card's
 * two sections. */
export async function listAutomations() {
  return db.whatsAppAutomation.findMany({ include: { template: true } });
}

/** A WhatsApp template's body text is fixed and pre-approved by Meta —
 * unlike the confirmation EMAIL, there's no rendering a different
 * sentence per event here. So "adapt per format" means picking between
 * up to two APPROVED templates per trigger (see AutomationFormatScope's
 * own schema comment): the VIRTUAL one, only for a pure VIRTUAL event,
 * when an admin has actually configured one; DEFAULT otherwise (also the
 * one used for IN_PERSON and HYBRID, both of which still have a real
 * entrada). Format omitted (older/other callers) behaves exactly as
 * before this scope existed — DEFAULT only. */
export async function getEnabledAutomation(trigger: WhatsAppAutomationTrigger, format?: EventFormat) {
  if (format === "VIRTUAL") {
    const override = await db.whatsAppAutomation.findFirst({
      where: { trigger, formatScope: "VIRTUAL", enabled: true },
      include: { template: true },
    });
    if (override) return override;
  }
  return db.whatsAppAutomation.findFirst({ where: { trigger, formatScope: "DEFAULT", enabled: true }, include: { template: true } });
}

export class AutomationValidationError extends Error {}

/** Creates the automation (first time picking a template for this
 * trigger + scope) or repoints an existing one at a different template —
 * either way it comes back enabled, since picking a template is an
 * "activate" action; use setAutomationEnabled to turn it off without
 * losing the pairing. */
export async function upsertAutomation(
  trigger: WhatsAppAutomationTrigger,
  templateId: string,
  formatScope: AutomationFormatScope = "DEFAULT",
  // {slot: mergeTagKey} — e.g. {"1": "EVENTO_NOMBRE", "2": "ZOOM_LINK"}.
  // Passing undefined leaves whatever mapping (if any) was already saved
  // untouched — lets the "Cambiar plantilla" select (which only sends
  // templateId) repoint the template without wiping a mapping the admin
  // set up moments before via a separate save. Pass {} explicitly to
  // clear it back to the old fixed convention.
  variableMapping?: Record<string, string>
) {
  const eligible = await listEligibleAutomationTemplates();
  if (!eligible.some((t) => t.id === templateId)) {
    throw new AutomationValidationError("Esa plantilla no está aprobada, o no tiene ni variables ni un botón de enlace dinámico.");
  }
  return db.whatsAppAutomation.upsert({
    where: { trigger_formatScope: { trigger, formatScope } },
    create: { trigger, formatScope, templateId, enabled: true, variableMapping: variableMapping ?? undefined },
    update: { templateId, enabled: true, ...(variableMapping !== undefined ? { variableMapping } : {}) },
    include: { template: true },
  });
}

export async function setAutomationEnabled(trigger: WhatsAppAutomationTrigger, enabled: boolean, formatScope: AutomationFormatScope = "DEFAULT") {
  return db.whatsAppAutomation.update({ where: { trigger_formatScope: { trigger, formatScope } }, data: { enabled }, include: { template: true } });
}

/** Removes the pairing entirely — back to "not configured", not just
 * off. Use setAutomationEnabled(trigger, false, formatScope) instead for
 * a temporary pause that keeps the chosen template. */
export async function deleteAutomation(trigger: WhatsAppAutomationTrigger, formatScope: AutomationFormatScope = "DEFAULT") {
  await db.whatsAppAutomation.delete({ where: { trigger_formatScope: { trigger, formatScope } } }).catch(() => {
    // Already unconfigured — deleting a non-existent row is a no-op, not
    // an error the caller needs to handle.
  });
}
