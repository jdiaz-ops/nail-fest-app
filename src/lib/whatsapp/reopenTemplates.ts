import { db } from "@/lib/db";
import type { WhatsAppTemplateButton } from "./provider";
import { dynamicUrlButtonIndex } from "./automations";
import type { ReopenTemplateOption } from "@/components/WhatsAppReopenTemplatePicker";

/** Templates the thread composer may send to reopen a closed 24h window:
 * APPROVED, and without a per-person URL button (the ticket automation's
 * kind, which needs a token the picker doesn't have). */
export async function listReopenTemplates(): Promise<ReopenTemplateOption[]> {
  const templates = await db.whatsAppTemplate.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } });
  return templates
    .filter((t) => dynamicUrlButtonIndex(t.buttons) < 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      bodyText: t.bodyText,
      variableCount: t.variableCount,
      quickReplies: (((t.buttons as unknown as WhatsAppTemplateButton[] | null) ?? []).filter((b) => b.type === "QUICK_REPLY") as { text: string }[]).map((b) => b.text),
    }));
}
