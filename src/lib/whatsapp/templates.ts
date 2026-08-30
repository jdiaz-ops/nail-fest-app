import { db } from "@/lib/db";
import type { WhatsAppTemplate } from "@prisma/client";
import { whatsappProvider } from "./index";
import type { CreateWhatsAppTemplateInput } from "./provider";

/** Pulls the current approved/pending/rejected template list from Meta's
 * WhatsApp Manager and upserts it onto WhatsAppTemplate — the mirror the
 * broadcast composer lists from. Called by the "Sincronizar" button on
 * CRM → WhatsApp → Plantillas; safe to call as often as wanted, it's a
 * pure upsert-by-(name, language) with no side effects on Meta's side.
 * Also what picks up a template's PENDING → APPROVED/REJECTED transition
 * after createAndSubmitTemplate() below submits it — there's no webhook
 * for that here, so re-syncing is how the local status catches up. */
export async function syncTemplates(): Promise<{ synced: number }> {
  const remote = await whatsappProvider.listTemplates();
  let synced = 0;
  for (const t of remote) {
    // Prisma's Json column wants a JSON-serializable value, never
    // `undefined` — [] for "no buttons" reads back the same as `[]`
    // stored on create, unlike `null` (which JSON.parse would return for
    // a JSON `null`), so an empty array is what round-trips cleanly.
    const buttons = t.buttons as unknown as object;
    await db.whatsAppTemplate.upsert({
      where: { name_language: { name: t.name, language: t.language } },
      create: {
        metaTemplateId: t.metaTemplateId,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        headerType: t.headerType,
        headerText: t.headerText,
        bodyText: t.bodyText,
        variableCount: t.variableCount,
        footerText: t.footerText,
        buttons,
      },
      update: {
        metaTemplateId: t.metaTemplateId,
        category: t.category,
        status: t.status,
        headerType: t.headerType,
        headerText: t.headerText,
        bodyText: t.bodyText,
        variableCount: t.variableCount,
        footerText: t.footerText,
        buttons,
        lastSyncedAt: new Date(),
      },
    });
    synced++;
  }
  return { synced };
}

const NAME_PATTERN = /^[a-z0-9_]+$/;
// {{1}}, {{2}}, ... — matches Meta's own numbering, must start at 1 and
// not skip a number (Meta rejects a submission that does either).
const PLACEHOLDER_PATTERN = /\{\{(\d+)\}\}/g;

export class TemplateValidationError extends Error {}

function assertValidTemplateInput(input: CreateWhatsAppTemplateInput): void {
  if (!NAME_PATTERN.test(input.name)) {
    throw new TemplateValidationError("El nombre solo puede tener minúsculas, números y guion bajo (_) — así lo exige Meta.");
  }
  const placeholderNumbers = [...input.bodyText.matchAll(PLACEHOLDER_PATTERN)].map((m) => Number(m[1]));
  const distinctSorted = [...new Set(placeholderNumbers)].sort((a, b) => a - b);
  const expected = distinctSorted.map((_, i) => i + 1);
  if (distinctSorted.some((n, i) => n !== expected[i])) {
    throw new TemplateValidationError("Las variables del cuerpo deben ser {{1}}, {{2}}, ... en orden, sin saltos.");
  }
  if (distinctSorted.length !== input.bodyExamples.length || input.bodyExamples.some((e) => !e.trim())) {
    throw new TemplateValidationError("Hace falta un valor de ejemplo por cada variable — Meta no revisa una plantilla sin ejemplos.");
  }
  if (input.buttons && input.buttons.length > 0) {
    if (input.buttons.length > 3) {
      throw new TemplateValidationError("Máximo 3 botones.");
    }
    const hasQuickReply = input.buttons.some((b) => b.type === "QUICK_REPLY");
    const hasCta = input.buttons.some((b) => b.type === "URL" || b.type === "PHONE_NUMBER");
    if (hasQuickReply && hasCta) {
      throw new TemplateValidationError("Meta no permite mezclar respuestas rápidas con botones de acción (URL/llamar) en la misma plantilla.");
    }
    if (hasCta && input.buttons.length > 2) {
      throw new TemplateValidationError("Máximo 2 botones de acción (uno de URL y uno de llamar).");
    }
  }
}

/** Submits a new template straight to Meta for review and stores it
 * locally right away (status PENDING, same as what Meta's own dashboard
 * would show) — no local-only draft state, since a template that was
 * never actually submitted isn't usable from Difusiones anyway (that
 * only offers APPROVED ones). Throws TemplateValidationError for a
 * catchable, user-facing message on a bad name/placeholder shape; any
 * other failure (network, Meta rejecting the submission itself) surfaces
 * as a plain Error from the provider call, same as every other
 * lib/whatsapp/* send path. */
export async function createAndSubmitTemplate(input: CreateWhatsAppTemplateInput): Promise<WhatsAppTemplate> {
  assertValidTemplateInput(input);

  const result = await whatsappProvider.createTemplate(input);
  const buttons = (input.buttons ?? []) as unknown as object;

  return db.whatsAppTemplate.upsert({
    where: { name_language: { name: input.name, language: input.language } },
    create: {
      metaTemplateId: result.metaTemplateId,
      name: input.name,
      language: input.language,
      category: input.category,
      status: result.status,
      headerType: input.headerText ? "TEXT" : "NONE",
      headerText: input.headerText ?? null,
      bodyText: input.bodyText,
      variableCount: input.bodyExamples.length,
      footerText: input.footerText ?? null,
      buttons,
    },
    update: {
      metaTemplateId: result.metaTemplateId,
      category: input.category,
      status: result.status,
      headerType: input.headerText ? "TEXT" : "NONE",
      headerText: input.headerText ?? null,
      bodyText: input.bodyText,
      variableCount: input.bodyExamples.length,
      footerText: input.footerText ?? null,
      buttons,
      lastSyncedAt: new Date(),
    },
  });
}
