import { db } from "@/lib/db";
import { whatsappProvider } from "./index";

/** Pulls the current approved/pending/rejected template list from Meta's
 * WhatsApp Manager and upserts it onto WhatsAppTemplate — the read-only
 * mirror the broadcast composer lists from. Called by the "Sincronizar"
 * button on CRM → WhatsApp → Plantillas; safe to call as often as wanted,
 * it's a pure upsert-by-(name, language) with no side effects on Meta's
 * side. */
export async function syncTemplates(): Promise<{ synced: number }> {
  const remote = await whatsappProvider.listApprovedTemplates();
  let synced = 0;
  for (const t of remote) {
    await db.whatsAppTemplate.upsert({
      where: { name_language: { name: t.name, language: t.language } },
      create: {
        metaTemplateId: t.metaTemplateId,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        bodyText: t.bodyText,
        variableCount: t.variableCount,
      },
      update: {
        metaTemplateId: t.metaTemplateId,
        category: t.category,
        status: t.status,
        bodyText: t.bodyText,
        variableCount: t.variableCount,
        lastSyncedAt: new Date(),
      },
    });
    synced++;
  }
  return { synced };
}
