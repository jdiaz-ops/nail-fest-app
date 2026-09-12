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
export const AUTOMATION_TRIGGERS: Record<WhatsAppAutomationTrigger, { label: string; description: string }> = {
  REGISTRATION_CONFIRMED: {
    label: "Cuando alguien se registra",
    description:
      "Justo después de la confirmación (registro nuevo o un reenvío), le llega un WhatsApp con un botón que abre su propia entrada — mismo enlace que \"Reenviar PDF por WhatsApp\" en Bandeja, pero funciona incluso fuera de la ventana de 24h porque es una plantilla, no un documento suelto.",
  },
};

export const AUTOMATION_TRIGGER_LIST = Object.keys(AUTOMATION_TRIGGERS) as WhatsAppAutomationTrigger[];

function isDynamicUrlButton(b: WhatsAppTemplateButton): boolean {
  return b.type === "URL" && b.url.includes("{{");
}

/** APPROVED templates with a dynamic URL button — the only kind any
 * automation built today can use (each one fires per-person, so a static
 * link would just send the same URL to everyone, defeating the point). */
export async function listEligibleAutomationTemplates(): Promise<{ id: string; name: string; language: string }[]> {
  const templates = await db.whatsAppTemplate.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } });
  return templates
    .filter((t) => ((t.buttons as unknown as WhatsAppTemplateButton[] | null) ?? []).some(isDynamicUrlButton))
    .map((t) => ({ id: t.id, name: t.name, language: t.language }));
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
export async function upsertAutomation(trigger: WhatsAppAutomationTrigger, templateId: string, formatScope: AutomationFormatScope = "DEFAULT") {
  const eligible = await listEligibleAutomationTemplates();
  if (!eligible.some((t) => t.id === templateId)) {
    throw new AutomationValidationError("Esa plantilla no está aprobada o no tiene un botón de enlace dinámico.");
  }
  return db.whatsAppAutomation.upsert({
    where: { trigger_formatScope: { trigger, formatScope } },
    create: { trigger, formatScope, templateId, enabled: true },
    update: { templateId, enabled: true },
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
